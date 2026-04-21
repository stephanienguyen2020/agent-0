"""
NL → task draft via Gemini JSON output, with server-side validation.

Used by POST /api/v1/tasks/draft-chat (no funds moved; separate from x402 publish).
"""

from __future__ import annotations

import json
import logging
import re
import ssl
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

from em_api.config import settings

logger = logging.getLogger(__name__)


def _generate_content_endpoint() -> str:
    mid = (getattr(settings, "gemini_chat_model", None) or "gemini-2.5-flash").strip()
    return f"https://generativelanguage.googleapis.com/v1beta/models/{mid}:generateContent?key={{key}}"

ALLOWED_CATEGORIES = frozenset(
    {
        "physical_presence",
        "knowledge_access",
        "human_authority",
        "agent_to_agent",
        "simple_action",
    }
)

_MIN_DEADLINE_AHEAD = timedelta(minutes=5)
_MAX_DEADLINE_AHEAD = timedelta(days=30)
_DEFAULT_DEADLINE_AHEAD = timedelta(hours=24)


def _ssl_context_for_outbound_https() -> ssl.SSLContext:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


def _parse_json_object(text: str) -> dict[str, Any] | None:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        out = json.loads(m.group())
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        return None


def normalize_category(raw: str | None) -> str | None:
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip().lower().replace(" ", "_").replace("-", "_")
    # common synonyms
    synonyms: dict[str, str] = {
        "physical": "physical_presence",
        "presence": "physical_presence",
        "geo": "physical_presence",
        "local": "physical_presence",
        "knowledge": "knowledge_access",
        "research": "knowledge_access",
        "human": "human_authority",
        "authority": "human_authority",
        "a2a": "agent_to_agent",
        "agents": "agent_to_agent",
        "simple": "simple_action",
    }
    if s in synonyms:
        s = synonyms[s]
    return s if s in ALLOWED_CATEGORIES else None


def bounty_usdc_to_micros(value: Any) -> int | None:
    try:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            n = float(value)
        elif isinstance(value, float):
            n = value
        elif isinstance(value, str):
            n = float(value.strip().replace(",", ""))
        else:
            return None
        if n <= 0 or n > 1_000_000:
            return None
        return int(round(n * 1_000_000))
    except (TypeError, ValueError, OverflowError):
        return None


def parse_deadline(raw: Any, *, now: datetime) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        try:
            ts = float(raw)
            if ts > 1e12:
                ts /= 1000.0
            dt = datetime.fromtimestamp(ts, tz=timezone.utc)
            return dt
        except (OSError, ValueError, OverflowError):
            return None
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        return None


# Assistant path: Gemini often omits `title` on confirmation turns; derive a short headline from instructions.
_INFERRED_TITLE_MAX_LEN = 120


def apply_inferred_task_title(draft: dict[str, Any]) -> dict[str, Any]:
    """
    Shallow copy of draft with `title` set from the first line of `instructions` when title is missing/blank.
    Used by assistant-chat only; draft-chat remains strict unless the caller opts in.
    """
    out = dict(draft)
    t = out.get("title")
    if isinstance(t, str) and t.strip():
        return out
    instr = out.get("instructions")
    if not isinstance(instr, str) or not instr.strip():
        return out
    line = instr.strip().split("\n", 1)[0].strip()
    if len(line) > _INFERRED_TITLE_MAX_LEN:
        line = line[: _INFERRED_TITLE_MAX_LEN - 1].rstrip() + "…"
    out["title"] = line
    return out


def validate_task_draft_dict(
    draft: dict[str, Any],
    *,
    now: datetime | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """
    Validate LLM-ish draft fields. Returns (payload for API, None) or (None, error).

    Output payload keys match TaskCreate / frontend TaskCreateBody (+ optional location).
    """
    now = now or datetime.now(timezone.utc)
    title = draft.get("title")
    instructions = draft.get("instructions")
    if not isinstance(title, str) or not title.strip():
        return None, "missing_title"
    if not isinstance(instructions, str) or not instructions.strip():
        return None, "missing_instructions"

    cat = normalize_category(draft.get("category"))
    if not cat:
        return None, "invalid_category"

    bounty_micros = bounty_usdc_to_micros(draft.get("bounty_usdc"))
    if bounty_micros is None or bounty_micros <= 0:
        bm = draft.get("bounty_micros")
        if isinstance(bm, int) and bm > 0:
            bounty_micros = bm
        elif isinstance(bm, str):
            try:
                bounty_micros = int(bm.strip())
            except ValueError:
                bounty_micros = None
        if bounty_micros is None or bounty_micros <= 0:
            return None, "invalid_bounty"

    raw_deadline = draft.get("deadline_at")
    deadline = parse_deadline(raw_deadline, now=now)
    if deadline is None:
        deadline = now + _DEFAULT_DEADLINE_AHEAD
    if deadline <= now + _MIN_DEADLINE_AHEAD:
        return None, "deadline_too_soon"
    if deadline > now + _MAX_DEADLINE_AHEAD:
        return None, "deadline_too_far"

    lat: float | None = None
    lng: float | None = None
    rad: int | None = None
    try:
        if draft.get("location_lat") is not None:
            lat = float(draft.get("location_lat"))
        if draft.get("location_lng") is not None:
            lng = float(draft.get("location_lng"))
        if draft.get("location_radius_m") is not None:
            rad = int(float(draft.get("location_radius_m")))
    except (TypeError, ValueError):
        return None, "invalid_location"

    if cat == "physical_presence":
        if lat is None or lng is None:
            return None, "physical_needs_location"
        if lat < -90 or lat > 90 or lng < -180 or lng > 180:
            return None, "invalid_lat_lng"
        if rad is None or rad <= 0:
            rad = 5000

    evidence_schema = draft.get("evidence_schema")
    exec_req = draft.get("executor_requirements")
    ev = evidence_schema if isinstance(evidence_schema, dict) else {}
    er = exec_req if isinstance(exec_req, dict) else {}

    out: dict[str, Any] = {
        "title": title.strip()[:500],
        "instructions": instructions.strip()[:20000],
        "category": cat,
        "bounty_micros": bounty_micros,
        "deadline_at": deadline.isoformat(),
        "evidence_schema": ev,
        "executor_requirements": er,
    }
    if lat is not None and lng is not None:
        out["location_lat"] = lat
        out["location_lng"] = lng
        out["location_radius_m"] = rad if rad is not None else 5000

    return out, None


def build_gemini_contents(messages: list[dict[str, str]]) -> list[dict[str, Any]]:
    """Map chat messages to Gemini contents (user/model turns)."""
    contents: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})
    return contents


def draft_chat_gemini(
    *,
    messages: list[dict[str, str]],
    api_key: str,
) -> dict[str, Any]:
    """
    Call Gemini; expect JSON with assistant_message, needs_clarification, draft (object|null).

    Returns DraftChat-shaped dict (may omit draft on parse failure).
    """
    schema_hint = json.dumps(
        {
            "assistant_message": "string — short reply to the user",
            "needs_clarification": "boolean",
            "draft": "object|null with keys: title, instructions, category, bounty_usdc (number), "
            "deadline_at (ISO 8601 UTC optional), location_lat, location_lng, location_radius_m optional",
        }
    )
    system = (
        "You help users draft tasks for the Execution Market on opBNB Testnet only — never ask which chain. "
        "Categories (exact snake_case values): physical_presence, knowledge_access, human_authority, "
        "agent_to_agent, simple_action. "
        "Use physical_presence when the task requires someone at a place (photo, visit); include "
        "location_lat, location_lng (decimal degrees) and location_radius_m (meters, default 5000). "
        "Bounty is in USDC (mock testnet token); use bounty_usdc as a decimal number (e.g. 0.05). "
        "If the user did not specify a deadline, omit deadline_at (server defaults to 24h from now). "
        "When you have enough information to publish, set needs_clarification false and fill draft; "
        "otherwise needs_clarification true and draft null. "
        "Reply with ONLY valid JSON matching this shape: "
        f"{schema_hint}"
    )

    contents = build_gemini_contents(messages)
    if not contents:
        return {
            "assistant_message": "Send a message describing the task you want posted.",
            "needs_clarification": True,
            "draft": None,
        }

    body = json.dumps(
        {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": contents,
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.3,
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        _generate_content_endpoint().format(key=api_key),
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    ssl_ctx = _ssl_context_for_outbound_https()
    try:
        with urllib.request.urlopen(req, timeout=60, context=ssl_ctx) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:800]
        logger.warning("gemini draft_chat HTTP %s: %s", e.code, err_body)
        if e.code == 400 and "API_KEY_INVALID" in err_body:
            raise RuntimeError(
                "gemini_key_invalid: Google rejected GEMINI_API_KEY (API_KEY_INVALID). "
                "Create a new API key in Google AI Studio (https://aistudio.google.com/apikey), "
                "set GEMINI_API_KEY in the repo root .env (not frontend/.env only), restart FastAPI, "
                "and ensure Generative Language API access is allowed for that key."
            ) from e
        if e.code in (400, 404) and (
            "was not found" in err_body
            or "not found for API version" in err_body
            or ("INVALID_ARGUMENT" in err_body and "model" in err_body.lower())
        ):
            mid = (getattr(settings, "gemini_chat_model", None) or "").strip()
            raise RuntimeError(
                f"gemini_model_error: Model '{mid}' may be wrong for generateContent. "
                f"Set GEMINI_CHAT_MODEL in .env to an id from "
                f"GET https://generativelanguage.googleapis.com/v1beta/models?key=… (e.g. gemini-2.5-flash)."
            ) from e
        raise RuntimeError(f"gemini_http_{e.code}") from e
    except Exception as e:
        logger.warning("gemini draft_chat error: %s", e)
        raise

    try:
        cand = raw["candidates"][0]
        if cand.get("finishReason") and cand.get("finishReason") not in ("STOP", "stop"):
            logger.warning("gemini finishReason=%s", cand.get("finishReason"))
        text = cand["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        raise RuntimeError("gemini_bad_response")

    if not isinstance(text, str):
        raise RuntimeError("gemini_bad_response")
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = _parse_json_object(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("gemini_unparseable")

    assistant_message = parsed.get("assistant_message")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        assistant_message = "I could not parse that. Try describing the task, bounty in USDC, and what you need done."

    needs_clarification = bool(parsed.get("needs_clarification", True))
    draft_raw = parsed.get("draft")

    result: dict[str, Any] = {
        "assistant_message": assistant_message.strip()[:8000],
        "needs_clarification": needs_clarification,
        "draft": None,
    }

    if draft_raw is None or not isinstance(draft_raw, dict):
        return result

    validated, err = validate_task_draft_dict(draft_raw)
    if validated is None:
        logger.debug("draft validation failed: %s", err)
        hints: dict[str, str] = {
            "missing_title": "Ask for a short title for the task.",
            "missing_instructions": "Ask what exactly the worker should deliver.",
            "invalid_category": "Ask which type fits best: physical presence, knowledge access, "
            "human authority, agent-to-agent, or simple action.",
            "invalid_bounty": "Ask for a bounty amount in USDC (greater than zero).",
            "deadline_too_soon": "Choose a deadline at least a few minutes from now.",
            "deadline_too_far": "Deadline cannot be more than 30 days ahead; suggest a shorter window.",
            "physical_needs_location": "For an on-location task, ask which city or coordinates apply.",
            "invalid_location": "Location values look invalid; ask for city or lat/lng.",
            "invalid_lat_lng": "Latitude/longitude must be valid.",
        }
        extra = hints.get(err or "", "Ask for any missing details.")
        result["assistant_message"] = (result["assistant_message"] + " " + extra).strip()[:8000]
        result["needs_clarification"] = True
        return result

    result["draft"] = validated
    result["needs_clarification"] = False
    return result


def draft_chat_dgrid(
    *,
    messages: list[dict[str, str]],
    api_key: str,
    base_url: str,
    model: str,
    http_referer: str | None,
) -> dict[str, Any]:
    """
    Same JSON contract as ``draft_chat_gemini`` via DGrid OpenAI-compatible chat completions.
    """
    from em_api.services.dgrid_gateway import chat_completion

    schema_hint = json.dumps(
        {
            "assistant_message": "string — short reply to the user",
            "needs_clarification": "boolean",
            "draft": "object|null with keys: title, instructions, category, bounty_usdc (number), "
            "deadline_at (ISO 8601 UTC optional), location_lat, location_lng, location_radius_m optional",
        }
    )
    system = (
        "You help users draft tasks for the Execution Market on opBNB Testnet only — never ask which chain. "
        "Categories (exact snake_case values): physical_presence, knowledge_access, human_authority, "
        "agent_to_agent, simple_action. "
        "Use physical_presence when the task requires someone at a place (photo, visit); include "
        "location_lat, location_lng (decimal degrees) and location_radius_m (meters, default 5000). "
        "Bounty is in USDC (mock testnet token); use bounty_usdc as a decimal number (e.g. 0.05). "
        "If the user did not specify a deadline, omit deadline_at (server defaults to 24h from now). "
        "When you have enough information to publish, set needs_clarification false and fill draft; "
        "otherwise needs_clarification true and draft null. "
        "Reply with ONLY valid JSON matching this shape: "
        f"{schema_hint}"
    )

    oa_messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for m in messages:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            oa_messages.append({"role": "assistant", "content": content})
        else:
            oa_messages.append({"role": "user", "content": content})

    if len(oa_messages) <= 1:
        return {
            "assistant_message": "Send a message describing the task you want posted.",
            "needs_clarification": True,
            "draft": None,
        }

    try:
        text = chat_completion(
            messages=oa_messages,
            api_key=api_key,
            base_url=base_url,
            model=model,
            temperature=0.3,
            timeout_sec=60,
            http_referer=http_referer,
        )
    except RuntimeError:
        raise

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        parsed = _parse_json_object(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("dgrid_unparseable")

    assistant_message = parsed.get("assistant_message")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        assistant_message = "I could not parse that. Try describing the task, bounty in USDC, and what you need done."

    needs_clarification = bool(parsed.get("needs_clarification", True))
    draft_raw = parsed.get("draft")

    result: dict[str, Any] = {
        "assistant_message": assistant_message.strip()[:8000],
        "needs_clarification": needs_clarification,
        "draft": None,
    }

    if draft_raw is None or not isinstance(draft_raw, dict):
        return result

    validated, err = validate_task_draft_dict(draft_raw)
    if validated is None:
        logger.debug("draft validation failed: %s", err)
        hints: dict[str, str] = {
            "missing_title": "Ask for a short title for the task.",
            "missing_instructions": "Ask what exactly the worker should deliver.",
            "invalid_category": "Ask which type fits best: physical presence, knowledge access, "
            "human authority, agent-to-agent, or simple action.",
            "invalid_bounty": "Ask for a bounty amount in USDC (greater than zero).",
            "deadline_too_soon": "Choose a deadline at least a few minutes from now.",
            "deadline_too_far": "Deadline cannot be more than 30 days ahead; suggest a shorter window.",
            "physical_needs_location": "For an on-location task, ask which city or coordinates apply.",
            "invalid_location": "Location values look invalid; ask for city or lat/lng.",
            "invalid_lat_lng": "Latitude/longitude must be valid.",
        }
        extra = hints.get(err or "", "Ask for any missing details.")
        result["assistant_message"] = (result["assistant_message"] + " " + extra).strip()[:8000]
        result["needs_clarification"] = True
        return result

    result["draft"] = validated
    result["needs_clarification"] = False
    return result
