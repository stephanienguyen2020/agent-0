"""Leaderboard — live rankings from `executors` (updated by `reputation_events` trigger)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1", tags=["leaderboard"])

_TYPE_QUERY_TO_DB = {
    "human": "human",
    "agent": "ai_agent",
    "robot": "robot",
}


@router.get("/leaderboard")
def get_leaderboard(
    type_filter: str | None = Query(None, alias="type", description="human | agent | robot (omit or all)"),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """Return ranked executors with `tasks_completed > 0`, sorted by score then tasks (matches MV intent without stale MV refresh)."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    q = (
        supa.table("executors")
        .select(
            "id, wallet, display_name, type, score, rating_bps, tasks_completed, "
            "tasks_disputed, dispute_losses, total_earned_micros"
        )
        .eq("active", True)
    )

    tf = (type_filter or "").strip().lower()
    if tf and tf not in ("all", ""):
        mapped = _TYPE_QUERY_TO_DB.get(tf)
        if not mapped:
            raise HTTPException(400, "type must be human, agent, robot, or all")
        q = q.eq("type", mapped)

    r = q.execute()
    rows = r.data or []

    def tc(row: dict) -> int:
        v = row.get("tasks_completed")
        try:
            return int(v or 0)
        except (TypeError, ValueError):
            return 0

    def sc(row: dict) -> int:
        v = row.get("score")
        try:
            return int(v or 0)
        except (TypeError, ValueError):
            return 0

    filtered = [row for row in rows if tc(row) > 0]
    filtered.sort(key=lambda row: (-sc(row), -tc(row), str(row.get("id") or "")))
    trimmed = filtered[:limit]

    out: list[dict] = []
    for i, row in enumerate(trimmed, start=1):
        eid = row.get("id")
        out.append(
            {
                "rank": i,
                "executor_id": str(eid) if eid is not None else "",
                "display_name": row.get("display_name") or (row.get("wallet") or "")[:10],
                "type": row.get("type"),
                "wallet": row.get("wallet"),
                "score": sc(row),
                "rating_bps": int(row.get("rating_bps") or 0),
                "tasks_completed": tc(row),
                "tasks_disputed": int(row.get("tasks_disputed") or 0),
                "dispute_losses": int(row.get("dispute_losses") or 0),
                "total_earned_micros": str(row.get("total_earned_micros") or 0),
            }
        )

    return {"executors": out}
