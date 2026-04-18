"""L2: Gemini — lightweight JSON review when GEMINI_API_KEY is set."""

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

_GEMINI_RETRY_CODES = frozenset({429, 503})
_GEMINI_MAX_RETRIES = max(1, int(os.environ.get("GEMINI_MAX_RETRIES", "5")))
_GEMINI_RETRY_BASE_SEC = float(os.environ.get("GEMINI_RETRY_BASE_SEC", "1.0"))


def _retry_delay_after_http_error(e: urllib.error.HTTPError, attempt: int) -> float:
    hdrs = getattr(e, "headers", None)
    ra = hdrs.get("Retry-After") if hdrs else None
    if ra:
        try:
            return min(float(ra), 120.0)
        except ValueError:
            pass
    return min(_GEMINI_RETRY_BASE_SEC * (2**attempt), 60.0)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:"
    "generateContent?key={key}"
)


def _ssl_context_for_outbound_https() -> ssl.SSLContext:
    """Prefer certifi's CA bundle so urllib matches httpx/curl on macOS/Python.org builds."""
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


def run_level2(category: str, evidence: dict[str, Any], api_key: str | None = None) -> Level2Result:
    if not api_key:
        return Level2Result(True, "skipped_no_api_key", 1.0, {})

    prompt = (
        "You are reviewing task evidence for an execution marketplace. "
        f"Category: {category!r}. Evidence (JSON): {json.dumps(evidence)[:8000]}\n"
        'Reply with ONLY a JSON object: {"passed": true|false, "confidence": 0.0-1.0, "reason": "short"}. '
        "Pass if evidence plausibly satisfies the category; fail if clearly empty or irrelevant."
    )
    body = json.dumps(
        {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        GEMINI_URL.format(key=api_key),
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    ssl_ctx = _ssl_context_for_outbound_https()
    raw: dict[str, Any] | None = None
    for attempt in range(_GEMINI_MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=45, context=ssl_ctx) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            break
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")[:500]
            if e.code in _GEMINI_RETRY_CODES and attempt < _GEMINI_MAX_RETRIES - 1:
                delay = _retry_delay_after_http_error(e, attempt)
                time.sleep(delay)
                continue
            return Level2Result(False, f"gemini_http_{e.code}", None, {"error": err_body})
        except Exception as e:
            return Level2Result(False, f"gemini_error:{e!s}", None, {})

    if raw is None:
        return Level2Result(False, "gemini_no_response", None, {})

    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        return Level2Result(False, "gemini_bad_response", None, {"raw_keys": list(raw.keys())})

    parsed = _parse_json_block(text) if isinstance(text, str) else None
    if not parsed:
        return Level2Result(False, "gemini_unparseable", None, {"snippet": str(text)[:300]})

    passed = bool(parsed.get("passed", False))
    try:
        conf = float(parsed.get("confidence", 0.0))
    except (TypeError, ValueError):
        conf = None
    reason = str(parsed.get("reason", "gemini"))

    return Level2Result(passed, reason, conf, {"model": "gemini-2.0-flash", "parsed": parsed})
