"""L2: Gemini — lightweight JSON review when GEMINI_API_KEY is set."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:"
    "generateContent?key={key}"
)


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
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:500]
        return Level2Result(False, f"gemini_http_{e.code}", None, {"error": err_body})
    except Exception as e:
        return Level2Result(False, f"gemini_error:{e!s}", None, {})

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
