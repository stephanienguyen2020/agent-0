"""
Conversational assistant: read-only tools (get_task, list_my_tasks), optional task draft,
and pending_actions for client-side mutations (approve, dispute, verify).

Uses Gemini JSON mode; tools execute server-side with wallet-scoped access checks.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.error
import urllib.request
from typing import Any

from em_api.services.task_draft_llm import (
    _generate_content_endpoint,
    _parse_json_object,
    _ssl_context_for_outbound_https,
    apply_inferred_task_title,
    validate_task_draft_dict,
)

logger = logging.getLogger(__name__)

# Task ids are tk_ + uuid4().hex (32 hex chars).
_TASK_ID_RE = re.compile(r"tk_[a-f0-9]{32}", re.IGNORECASE)
_MOST_RECENT_TASK_ID_RE = re.compile(
    r"(?is)(?:most\s+recent(?:\s+task)?|recent\s+task)[\s\S]{0,400}?(tk_[a-f0-9]{32})",
)
_EXECUTOR_FOLLOWUP_INTENT_RE = re.compile(
    r"(?is)\b("
    r"accept(?:ed|ance)?|anyone\s+accept|did\s+anyone|who\s+took|who\s+accepted|"
    r"executor|still\s+published|picked\s+up|someone\s+take|taken\s+yet|"
    r"has\s+anyone\s+accepted|assigned\s+yet"
    r")\b",
)


def _latest_user_message_text(messages: list[dict[str, str]]) -> str:
    for m in reversed(messages):
        if (m.get("role") or "").strip() != "user":
            continue
        c = (m.get("content") or "").strip()
        if c:
            return c
    return ""


def _last_assistant_message_text(messages: list[dict[str, str]]) -> str:
    for m in reversed(messages):
        if (m.get("role") or "").strip() != "assistant":
            continue
        c = (m.get("content") or "").strip()
        if c:
            return c
    return ""


def _user_needs_executor_followup(user_text: str) -> bool:
    """Vague follow-up about acceptance/executor — user did not paste a tk_ id."""
    t = (user_text or "").strip()
    if not t or _TASK_ID_RE.search(t):
        return False
    return bool(_EXECUTOR_FOLLOWUP_INTENT_RE.search(t))


def _resolve_focus_task_id(
    *,
    latest_user_text: str,
    last_assistant_text: str,
    recent_tasks_rows: list[dict[str, Any]],
) -> str | None:
    """
    Infer which task vague follow-ups refer to: single tk in last assistant, 'most recent' line, or DB-first row.
    """
    if _TASK_ID_RE.search(latest_user_text):
        return None

    if last_assistant_text:
        found = _TASK_ID_RE.findall(last_assistant_text)
        uniq = list(dict.fromkeys(found))
        if len(uniq) == 1:
            return uniq[0]
        mr = _MOST_RECENT_TASK_ID_RE.search(last_assistant_text)
        if mr:
            return mr.group(1)

    if recent_tasks_rows and isinstance(recent_tasks_rows[0], dict):
        tid = recent_tasks_rows[0].get("task_id")
        if isinstance(tid, str) and tid.startswith("tk_"):
            return tid
    return None


def _focus_task_id_for_followup(supa: Any, wallet: str, messages: list[dict[str, str]]) -> str | None:
    lu = _latest_user_message_text(messages)
    la = _last_assistant_message_text(messages)
    rows = _tool_list_my_tasks(supa, wallet, 12).get("tasks")
    row_list = rows if isinstance(rows, list) else []
    return _resolve_focus_task_id(
        latest_user_text=lu,
        last_assistant_text=la,
        recent_tasks_rows=[x for x in row_list if isinstance(x, dict)],
    )


def _tool_calls_include_get_task_for(calls: list[dict[str, Any]], task_id: str) -> bool:
    tid = task_id.strip().lower()
    for tc in calls:
        if not isinstance(tc, dict):
            continue
        if (tc.get("name") or "").strip() != "get_task":
            continue
        args = tc.get("arguments") if isinstance(tc.get("arguments"), dict) else {}
        cur = str(args.get("task_id") or "").strip().lower()
        if cur == tid:
            return True
    return False


def _merge_executor_followup_get_task(
    *,
    messages: list[dict[str, str]],
    supa: Any,
    wallet: str,
    parsed_tool_calls: Any,
) -> list[dict[str, Any]]:
    """Prepend get_task(focus_id) when the model skipped tools on an executor/acceptance follow-up."""
    calls_in = parsed_tool_calls if isinstance(parsed_tool_calls, list) else []
    calls = [x for x in calls_in if isinstance(x, dict)]

    lu = _latest_user_message_text(messages)
    if not _user_needs_executor_followup(lu):
        return calls

    focus = _focus_task_id_for_followup(supa, wallet, messages)
    if not focus:
        return calls
    if _tool_calls_include_get_task_for(calls, focus):
        return calls

    injected = {"name": "get_task", "arguments": {"task_id": focus}}
    return [injected] + calls


def _gemini_json_response(
    *,
    system_instruction: str,
    contents: list[dict[str, Any]],
    api_key: str,
) -> dict[str, Any]:
    """POST generateContent with responseMimeType application/json; return parsed dict."""
    body = json.dumps(
        {
            "systemInstruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.25},
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
        with urllib.request.urlopen(req, timeout=90, context=ssl_ctx) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")[:800]
        logger.warning("gemini assistant HTTP %s: %s", e.code, err_body)
        raise RuntimeError(f"gemini_http_{e.code}") from e

    try:
        text = raw["candidates"][0]["content"]["parts"][0]["text"]
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
    return parsed


def _enrich_task_row(supa: Any, row: dict[str, Any]) -> dict[str, Any]:
    out = dict(row)
    aid = out.get("agent_id")
    if aid:
        ar = supa.table("agents").select("wallet").eq("id", str(aid)).single().execute()
        if ar.data:
            out["requester_wallet"] = ar.data.get("wallet")
    eid = out.get("executor_id")
    if eid:
        er = supa.table("executors").select("wallet").eq("id", str(eid)).single().execute()
        if er.data:
            out["executor_wallet"] = er.data.get("wallet")
    return out


def _compact_task(row: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k in (
        "task_id",
        "title",
        "status",
        "bounty_micros",
        "deadline_at",
        "updated_at",
        "created_at",
        "requester_wallet",
        "executor_wallet",
    ):
        if k in row:
            out[k] = row[k]
    instr = row.get("instructions")
    if isinstance(instr, str) and instr.strip():
        out["instructions_preview"] = instr.strip()[:600]
    return out


def _tool_get_task(supa: Any, task_id: str, wallet: str) -> dict[str, Any]:
    tid = (task_id or "").strip()
    if not tid.startswith("tk_"):
        return {"error": "invalid_task_id"}
    r = supa.table("tasks").select("*").eq("task_id", tid).single().execute()
    if not r.data:
        return {"error": "not_found"}
    row = _enrich_task_row(supa, dict(r.data))
    wl = wallet.lower().strip()
    rq = (row.get("requester_wallet") or "").lower().strip()
    ex = (row.get("executor_wallet") or "").lower().strip()
    if wl != rq and wl != ex:
        return {"error": "forbidden", "message": "Wallet is not the requester or executor for this task."}
    return {"task": _compact_task(row)}


def _tool_list_my_tasks(supa: Any, wallet: str, limit: int = 20) -> dict[str, Any]:
    w = wallet.lower().strip()
    ar = supa.table("agents").select("id").eq("wallet", w).limit(1).execute()
    if not ar.data:
        return {"tasks": [], "note": "No agent profile for this wallet yet (publish a task first)."}
    aid = ar.data[0]["id"]
    lim = max(1, min(int(limit or 20), 50))
    rows = (
        supa.table("tasks")
        .select("task_id,title,status,bounty_micros,deadline_at,updated_at,created_at")
        .eq("agent_id", aid)
        .order("updated_at", desc=True)
        .limit(lim)
        .execute()
    )
    return {"tasks": rows.data or [], "wallet": w}


def _recent_tasks_context_for_wallet(
    supa: Any,
    wallet: str,
    *,
    limit: int = 12,
    max_chars: int = 6000,
) -> str:
    """
    Compact lines of task_id + title + status for every assistant turn so the model can resolve
    follow-ups (e.g. acceptance) without the user pasting tk_… again.
    """
    lim = max(1, min(int(limit), 50))
    data = _tool_list_my_tasks(supa, wallet, lim)
    rows = data.get("tasks") if isinstance(data.get("tasks"), list) else []
    if isinstance(data.get("note"), str) and not rows:
        return "[Recent tasks for your wallet]\n(empty — " + data["note"][:200] + ")\n"

    lines_out: list[str] = []
    header = (
        "[Recent tasks for your wallet — use get_task(task_id) for executor/acceptance/evidence detail]\n"
        "(First row is most recently updated. Always include tk_… in prose when naming a task.)\n"
    )
    for row in rows:
        if not isinstance(row, dict):
            continue
        tid = str(row.get("task_id") or "").strip()
        title = str(row.get("title") or "").strip().replace("\n", " ")
        if len(title) > 72:
            title = title[:69] + "…"
        status = str(row.get("status") or "").strip()
        upd = str(row.get("updated_at") or row.get("created_at") or "").strip()
        lines_out.append(f"{tid}\tstatus={status}\tupdated={upd}\t{title}")

    body = "\n".join(lines_out)
    chunk = header + body
    if len(chunk) > max_chars:
        chunk = chunk[: max_chars - 20] + "\n…(truncated)"

    return chunk + "\n"


def _execute_tool_calls(
    supa: Any,
    wallet: str,
    calls: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tc in calls:
        name = (tc.get("name") or "").strip()
        args = tc.get("arguments") if isinstance(tc.get("arguments"), dict) else {}
        try:
            if name == "get_task":
                out.append({"name": name, "result": _tool_get_task(supa, str(args.get("task_id", "")), wallet)})
            elif name == "list_my_tasks":
                lim = args.get("limit", 20)
                out.append(
                    {
                        "name": name,
                        "result": _tool_list_my_tasks(supa, wallet, int(lim) if lim is not None else 20),
                    }
                )
            else:
                out.append({"name": name, "result": {"error": "unknown_tool"}})
        except Exception as e:
            out.append({"name": name, "result": {"error": str(e)[:200]}})
    return out


def _filter_pending_actions(supa: Any, wallet: str, actions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only actions the wallet may perform given current task state."""
    wl = wallet.lower().strip()
    gate = True  # default match API
    try:
        from em_api.config import settings as _s  # noqa: PLC0415

        gate = bool(_s.requester_approval_before_verify)
    except Exception:
        pass

    kept: list[dict[str, Any]] = []
    for a in actions:
        if not isinstance(a, dict):
            continue
        t = (a.get("type") or "").strip().lower().replace("-", "_")
        tid = (a.get("task_id") or "").strip()
        if not tid.startswith("tk_"):
            continue
        tr = supa.table("tasks").select("*").eq("task_id", tid).single().execute()
        if not tr.data:
            continue
        task = _enrich_task_row(supa, dict(tr.data))
        st = str(task.get("status") or "")
        rq = (task.get("requester_wallet") or "").lower().strip()
        ex = (task.get("executor_wallet") or "").lower().strip()
        is_req = wl == rq
        is_exe = wl == ex

        if t == "approve_evidence":
            if gate and st == "awaiting_requester_review" and is_req:
                kept.append({"type": "approve_evidence", "task_id": tid})
        elif t == "open_dispute":
            reason = str(a.get("reason") or "").strip()
            if len(reason) < 3:
                continue
            if st in ("submitted", "verified", "awaiting_requester_review") and (is_req or is_exe):
                kept.append({"type": "open_dispute", "task_id": tid, "reason": reason[:500]})
        elif t in ("verify_release", "verify"):
            if st == "submitted":
                kept.append({"type": "verify_release", "task_id": tid})
        elif t == "accept_task":
            if st == "published" and is_exe:
                kept.append({"type": "accept_task", "task_id": tid})
    return kept


def assistant_chat_turn(
    *,
    messages: list[dict[str, str]],
    requester_wallet: str,
    supa: Any,
    api_key: str,
) -> dict[str, Any]:
    """
    Run assistant with optional tool loop (max one tool round), then validate draft/pending_actions.

    Response keys align with frontend AssistantChatResponse.
    """
    wallet = requester_wallet.strip()
    if not wallet.startswith("0x"):
        raise ValueError("invalid wallet")

    schema = json.dumps(
        {
            "assistant_message": "string",
            "needs_clarification": "boolean",
            "draft": "object|null (task creation — same fields as draft-chat)",
            "tool_calls": "array of {name: get_task|list_my_tasks, arguments: object}",
            "pending_actions": "array of {type: approve_evidence|open_dispute|verify_release|accept_task, task_id, reason?}",
        }
    )

    recent_tasks_block = _recent_tasks_context_for_wallet(supa, wallet)

    system_1 = (
        recent_tasks_block
        + "\nYou are the Execution Market assistant on opBNB Testnet only. Never ask which chain.\n"
        f"The user's wallet (requester context) is: {wallet}\n"
        "Whenever you refer to a specific task from list_my_tasks, get_task, or the Recent tasks block above, "
        "your natural-language answer MUST include that task's task_id (tk_…) so follow-up turns stay grounded.\n"
        "For questions about acceptance, executor, who took the task, published vs accepted, or evidence detail, "
        "call get_task with task_id resolved from the Recent tasks block above or from a tk_… in the thread — "
        "list_my_tasks alone may omit executor_wallet; do not skip get_task when those fields matter.\n"
        "Do not ask the user for a task id if the Recent tasks block or prior tool results already contain one "
        "that matches the task they mean (e.g. only one recent task, or title matches).\n"
        "When they ask about tasks, status, applicants, deadlines, or mention a tk_ id, use tool_calls:\n"
        "- get_task: arguments {task_id}\n"
        "- list_my_tasks: arguments {limit?: number}\n"
        "When they want to create a market task, fill draft (categories: physical_presence, knowledge_access, "
        "human_authority, agent_to_agent, simple_action) with bounty_usdc, instructions, title, etc.\n"
        "Every draft MUST include a non-empty string field `title` (short headline), including when the user only "
        "says yes/ok/proceed — same full draft object as the first proposal, never omit title.\n"
        "When the user confirms task creation (e.g. yes, ok, proceed), you MUST include the complete draft object "
        "in JSON — same shape as when first proposing the task — not prose-only; never ask them to review details "
        "without including draft. For physical_presence, draft MUST include location_lat and location_lng "
        "(use rough defaults if unspecified, e.g. city center).\n"
        "When they clearly ask to approve evidence, open a dispute, run verify/release, or accept as executor, "
        "add pending_actions with task_id from context or tools — do not invent task ids.\n"
        "open_dispute must include non-empty reason (min 3 chars).\n"
        "Reply with ONLY valid JSON matching: "
        + schema
    )

    contents = []
    for m in messages:
        role = m.get("role", "user")
        content = (m.get("content") or "").strip()
        if not content:
            continue
        if role == "assistant":
            contents.append({"role": "model", "parts": [{"text": content}]})
        else:
            contents.append({"role": "user", "parts": [{"text": content}]})

    if not contents:
        return {
            "assistant_message": "Ask about your tasks (say list my tasks), a task id (tk_…), or describe a new task.",
            "needs_clarification": True,
            "draft": None,
            "pending_actions": [],
        }

    parsed = _gemini_json_response(system_instruction=system_1, contents=contents, api_key=api_key)

    calls_list = _merge_executor_followup_get_task(
        messages=messages,
        supa=supa,
        wallet=wallet,
        parsed_tool_calls=parsed.get("tool_calls"),
    )
    if calls_list:
        results = _execute_tool_calls(supa, wallet, calls_list)
        follow = (
            "Tool results (JSON):\n"
            + json.dumps(results, default=str)[:12000]
            + "\n\nWrite a concise assistant_message summarizing this for the user. "
            "When naming a specific task from these results, include its task_id (tk_…) in the prose. "
            "For acceptance, executor, or who accepted, base the answer on get_task results (executor_wallet, status); "
            "do not ask the user for a task id if these results or the opening Recent tasks block already identify the task. "
            "If they were creating or confirming a task, include the full draft object when the task is ready for "
            "review or publish (same fields as draft-chat), including non-empty title; only use draft null when this turn is not about "
            "task creation. Include pending_actions only if user intent matches. "
            "Return ONLY JSON with keys assistant_message, needs_clarification, draft, pending_actions."
        )
        contents2 = contents + [{"role": "user", "parts": [{"text": follow}]}]
        summarizer_si = (
            recent_tasks_block
            + "\nSummarize tool results; output JSON only with keys assistant_message, needs_clarification, draft, pending_actions. "
            "Include tk_… when naming a concrete task. For executor/acceptance questions, use get_task fields from the tool JSON; "
            "never ask the user for a task id when the Recent tasks block above or tool results already supply it. "
            "If the user was creating a task, include the full draft when applicable, with a non-empty title string."
        )
        parsed = _gemini_json_response(
            system_instruction=summarizer_si,
            contents=contents2,
            api_key=api_key,
        )

    assistant_message = parsed.get("assistant_message")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        assistant_message = "I could not produce a reply. Try rephrasing."

    needs_clarification = bool(parsed.get("needs_clarification", False))

    draft_out: dict[str, Any] | None = None
    draft_validation_error: str | None = None
    raw_draft = parsed.get("draft")
    if isinstance(raw_draft, dict):
        normalized = apply_inferred_task_title(raw_draft)
        vd, err = validate_task_draft_dict(normalized)
        if vd is not None:
            draft_out = vd
        elif err:
            draft_validation_error = err
            logger.info("assistant draft validation failed: %s", err)

    pending_raw = parsed.get("pending_actions")
    pending_list: list[dict[str, Any]] = []
    if isinstance(pending_raw, list):
        pending_list = _filter_pending_actions(supa, wallet, [x for x in pending_raw if isinstance(x, dict)])

    out: dict[str, Any] = {
        "assistant_message": assistant_message.strip()[:12000],
        "needs_clarification": needs_clarification,
        "draft": draft_out,
        "pending_actions": pending_list,
    }
    if draft_validation_error is not None:
        out["draft_validation_error"] = draft_validation_error
    return out
