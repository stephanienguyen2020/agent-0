"""Disputes listing (read-only) for hub UI."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1/disputes", tags=["disputes"])

_DISPUTE_STATUSES = frozenset(
    {
        "open",
        "under_review",
        "resolved_executor",
        "resolved_requester",
        "withdrawn",
    }
)


def _task_ids_for_wallet(supa: Any, wallet: str) -> set[str]:
    w = wallet.strip().lower()
    if not w:
        return set()
    ar = supa.table("agents").select("id").eq("wallet", w).execute()
    er = supa.table("executors").select("id").eq("wallet", w).execute()
    agent_ids = [str(x["id"]) for x in (ar.data or [])]
    executor_ids = [str(x["id"]) for x in (er.data or [])]
    task_ids: set[str] = set()
    if agent_ids:
        tr = supa.table("tasks").select("task_id").in_("agent_id", agent_ids).execute()
        for row in tr.data or []:
            task_ids.add(str(row["task_id"]))
    if executor_ids:
        tr = supa.table("tasks").select("task_id").in_("executor_id", executor_ids).execute()
        for row in tr.data or []:
            task_ids.add(str(row["task_id"]))
    return task_ids


@router.get("")
def list_disputes(
    wallet: str | None = Query(None, description="Lowercase wallet; restrict to tasks where wallet is requester or executor"),
    status: str | None = Query(None, description="Filter by disputes.status"),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Return dispute rows joined with task summary fields, newest first."""
    if status is not None and str(status).strip():
        st = str(status).strip().lower()
        if st not in _DISPUTE_STATUSES:
            raise HTTPException(400, "invalid status")

    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    allowed_task_ids: set[str] | None = None
    if wallet is not None and str(wallet).strip():
        allowed_task_ids = _task_ids_for_wallet(supa, str(wallet))
        if not allowed_task_ids:
            return {"disputes": []}

    q = supa.table("disputes").select("*").order("created_at", desc=True).limit(limit)
    if status is not None and str(status).strip():
        q = q.eq("status", str(status).strip().lower())
    if allowed_task_ids is not None:
        q = q.in_("task_id", sorted(allowed_task_ids))

    r = q.execute()
    rows = r.data or []

    task_ids = [str(d["task_id"]) for d in rows]
    tasks_map: dict[str, dict[str, Any]] = {}
    if task_ids:
        tr = (
            supa.table("tasks")
            .select("task_id, title, status, bounty_micros, category")
            .in_("task_id", task_ids)
            .execute()
        )
        for t in tr.data or []:
            tasks_map[str(t["task_id"])] = t

    out: list[dict[str, Any]] = []
    for d in rows:
        tid = str(d["task_id"])
        t = tasks_map.get(tid, {})
        bounty = t.get("bounty_micros")
        out.append(
            {
                "id": str(d.get("id", "")),
                "task_id": tid,
                "raised_by": d.get("raised_by"),
                "raised_by_wallet": d.get("raised_by_wallet"),
                "reason": d.get("reason"),
                "status": d.get("status"),
                "arbitration_case_id": d.get("arbitration_case_id"),
                "resolution": d.get("resolution"),
                "resolved_at": d.get("resolved_at"),
                "created_at": d.get("created_at"),
                "task_title": t.get("title"),
                "task_status": t.get("status"),
                "task_bounty_micros": str(bounty) if bounty is not None else None,
                "task_category": t.get("category"),
            }
        )

    return {"disputes": out}
