"""L2: DGrid x402 pay-per-inference (https://docs.dgrid.ai/x402-api-reference)."""

from __future__ import annotations

import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

_RETRY_CODES = frozenset({429, 503})
_MAX_RETRIES = max(1, int(os.environ.get("DGRID_MAX_RETRIES", os.environ.get("GEMINI_MAX_RETRIES", "5"))))
_RETRY_BASE_SEC = float(os.environ.get("DGRID_RETRY_BASE_SEC", os.environ.get("GEMINI_RETRY_BASE_SEC", "1.0")))


def _retry_delay_after_http_error(e: urllib.error.HTTPError, attempt: int) -> float:
    hdrs = getattr(e, "headers", None)
    ra = hdrs.get("Retry-After") if hdrs else None
    if ra:
        try:
            return min(float(ra), 120.0)
        except ValueError:
            pass
    return min(_RETRY_BASE_SEC * (2**attempt), 60.0)


def _ssl_context_for_outbound_https() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


@dataclass
class Level2Result:
    passed: bool
    reason: str
    confidence: float | None
    details: dict[str, Any]


def _parse_json_block(text: str) -> dict[str, Any] | None:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group())
    except json.JSONDecodeError:
        return None


def _maybe_build_payment(accepts: list[dict[str, Any]], private_key_hex: str | None) -> str | None:
    if not accepts or not private_key_hex:
        return None
    try:
        from em_api.services.dgrid_x402_payment import build_x_payment_header  # noqa: PLC0415

        return build_x_payment_header(accepts, private_key_hex)
    except Exception:
        return None


def run_level2(
    category: str,
    evidence: dict[str, Any],
    *,
    x402_url: str = "https://api.dgrid.ai/x402/v1",
    model: str = "openai/gpt-4o",
    payment_header: str | None = None,
    private_key_hex: str | None = None,
) -> Level2Result:
    """
    POST DGrid x402 inference with ``stream: false``.
    First request omits ``x-payment`` (unless ``payment_header`` is pre-set).
    On 402, retry once with ``x-payment`` when a header is available or auto-sign returns a value.
    """
    root = x402_url.rstrip("/")
    prompt = (
        "You are reviewing task evidence for an Agent Zero marketplace task. "
        f"Category: {category!r}. Evidence (JSON): {json.dumps(evidence)[:8000]}\n"
        'Reply with ONLY a JSON object: {"passed": true|false, "confidence": 0.0-1.0, "reason": "short"}. '
        "Pass if evidence plausibly satisfies the category; fail if clearly empty or irrelevant."
    )
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    ssl_ctx = _ssl_context_for_outbound_https()

    hdr_pre = (payment_header or "").strip() or None
    key_in = (private_key_hex or "").strip() or None

    def _request(x_payment: str | None) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if x_payment:
            headers["x-payment"] = x_payment
        req = urllib.request.Request(
            root,
            data=body_bytes,
            headers=headers,
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=90, context=ssl_ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))

    raw: dict[str, Any] | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            raw = _request(hdr_pre)
            break
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:4000]
            if e.code == 402 and not hdr_pre:
                try:
                    data = json.loads(err_body)
                except json.JSONDecodeError:
                    return Level2Result(
                        False,
                        "x402_402_unparseable",
                        None,
                        {"error": err_body[:500]},
                    )
                accepts = data.get("accepts")
                if not isinstance(accepts, list):
                    accepts = []
                pay = _maybe_build_payment(accepts, key_in)
                if not pay:
                    return Level2Result(
                        False,
                        "x402_payment_required",
                        None,
                        {
                            "accepts": accepts,
                            "x402Version": data.get("x402Version"),
                            "hint": "Set DGRID_X402_PAYMENT_HEADER after the wallet step, or implement "
                            "build_x_payment_header in em_api.services.dgrid_x402_payment.",
                        },
                    )
                try:
                    raw = _request(pay)
                    break
                except urllib.error.HTTPError as e2:
                    body2 = e2.read().decode("utf-8", errors="replace")[:800]
                    if e2.code in _RETRY_CODES and attempt < _MAX_RETRIES - 1:
                        time.sleep(_retry_delay_after_http_error(e2, attempt))
                        continue
                    return Level2Result(False, f"x402_retry_http_{e2.code}", None, {"error": body2})
            elif e.code in _RETRY_CODES and attempt < _MAX_RETRIES - 1:
                time.sleep(_retry_delay_after_http_error(e, attempt))
                continue
            return Level2Result(False, f"dgrid_x402_http_{e.code}", None, {"error": err_body[:500]})
        except Exception as e:
            return Level2Result(False, f"dgrid_x402_error:{e!s}", None, {})

    if raw is None:
        return Level2Result(False, "dgrid_x402_no_response", None, {})

    try:
        text = raw["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return Level2Result(False, "dgrid_x402_bad_response", None, {"raw_keys": list(raw.keys())})

    if not isinstance(text, str):
        return Level2Result(False, "dgrid_x402_bad_response", None, {})

    parsed = _parse_json_block(text)
    if not parsed:
        return Level2Result(False, "dgrid_x402_unparseable", None, {"snippet": str(text)[:300]})

    passed = bool(parsed.get("passed", False))
    try:
        conf = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        conf = None
    reason = str(parsed.get("reason", "dgrid_x402"))

    return Level2Result(
        passed,
        reason,
        conf,
        {"model": model, "parsed": parsed, "endpoint": root, "mode": "x402"},
    )
