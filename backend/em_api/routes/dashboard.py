"""Dashboard overview — aggregated KPIs and charts from Supabase (`tasks`, `executors`)."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1", tags=["dashboard"])

UTC = timezone.utc

_CATEGORY_LABELS: dict[str, str] = {
    "physical_presence": "Physical Presence",
    "knowledge_access": "Knowledge Access",
    "human_authority": "Human Authority",
    "simple_action": "Simple Action",
    "digital_physical": "Digital / Physical",
}

_MAX_CATEGORY_ROWS = 8000
_MAX_VOLUME_TASKS = 12000
_ALL_RANGE_DAYS = 90


def _parse_ts(raw: object) -> datetime | None:
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _delta_pct(current: float, previous: float) -> float | None:
    if previous <= 0:
        return None
    return round((current - previous) / previous * 100, 1)


def _micros_int(v: object) -> int:
    try:
        return int(v or 0)
    except (TypeError, ValueError):
        return 0


def _sc(row: dict) -> int:
    try:
        return int(row.get("score") or 0)
    except (TypeError, ValueError):
        return 0


def _tc(row: dict) -> int:
    try:
        return int(row.get("tasks_completed") or 0)
    except (TypeError, ValueError):
        return 0


def _executor_type_display(t: str | None) -> str:
    s = (t or "").lower()
    if s == "human":
        return "Human"
    if s == "ai_agent":
        return "Agent"
    if s == "robot":
        return "Robot"
    return s or "—"


@router.get("/dashboard/overview")
def get_dashboard_overview(
    volume_range: str = Query(
        "7d",
        description="24h | 7d | 30d | all — task volume bucket granularity (created_at)",
    ),
) -> dict:
    """
    Snapshot metrics from Supabase (not on-chain). **Recent Settlements** = latest completed tasks.
    **Executors highlight** = top active executors by score (proxy, not websocket “online”).
    """
    vr = (volume_range or "7d").strip().lower()
    if vr not in ("24h", "7d", "30d", "all"):
        raise HTTPException(400, "volume_range must be 24h, 7d, 30d, or all")

    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    now = _now_utc()

    # --- KPI: tasks completed (total) ---
    rc = supa.table("tasks").select("task_id", count="exact").eq("status", "completed").execute()
    tasks_completed_total = int(rc.count or 0)

    # Completed in last 7d vs prior 7d (by settled_at)
    t7 = now - timedelta(days=7)
    t14 = now - timedelta(days=14)
    c_cur = (
        supa.table("tasks")
        .select("task_id", count="exact")
        .eq("status", "completed")
        .gte("settled_at", t7.isoformat())
        .execute()
    )
    c_prev = (
        supa.table("tasks")
        .select("task_id", count="exact")
        .eq("status", "completed")
        .gte("settled_at", t14.isoformat())
        .lt("settled_at", t7.isoformat())
        .execute()
    )
    completed_7d = int(c_cur.count or 0)
    completed_prev_7d = int(c_prev.count or 0)

    # --- KPI: active executors ---
    ex_cnt = supa.table("executors").select("id", count="exact").eq("active", True).execute()
    active_executors = int(ex_cnt.count or 0)

    # --- KPI: USDC volume 24h (bounty only, completed tasks) ---
    t48 = now - timedelta(hours=48)
    vol_rows = (
        supa.table("tasks")
        .select("bounty_micros,settled_at")
        .eq("status", "completed")
        .gte("settled_at", t48.isoformat())
        .execute()
    )
    t24 = now - timedelta(hours=24)
    bounty_24h = 0
    bounty_prev_24h = 0
    for row in vol_rows.data or []:
        st = _parse_ts(row.get("settled_at"))
        if st is None:
            continue
        b = _micros_int(row.get("bounty_micros"))
        if st >= t24:
            bounty_24h += b
        elif st >= t48:
            bounty_prev_24h += b

    # --- KPI: average completion minutes ---
    avg_rows = (
        supa.table("tasks")
        .select("accepted_at,created_at,settled_at")
        .eq("status", "completed")
        .limit(2000)
        .execute()
    )
    minutes_list: list[float] = []
    minutes_cur: list[float] = []
    minutes_prev: list[float] = []
    t7_ts = t7.timestamp()
    t14_ts = t14.timestamp()
    for row in avg_rows.data or []:
        settled = _parse_ts(row.get("settled_at"))
        if settled is None:
            continue
        start = _parse_ts(row.get("accepted_at")) or _parse_ts(row.get("created_at"))
        if start is None:
            continue
        delta_min = (settled - start).total_seconds() / 60.0
        if delta_min < 0:
            continue
        minutes_list.append(delta_min)
        settled_ts = settled.timestamp()
        if settled_ts >= t7_ts:
            minutes_cur.append(delta_min)
        elif settled_ts >= t14_ts:
            minutes_prev.append(delta_min)

    avg_completion = None
    if minutes_list:
        avg_completion = round(sum(minutes_list) / len(minutes_list), 2)

    avg_completion_delta_pct = None
    if minutes_cur and minutes_prev:
        a_cur = sum(minutes_cur) / len(minutes_cur)
        a_prev = sum(minutes_prev) / len(minutes_prev)
        avg_completion_delta_pct = _delta_pct(a_cur, a_prev)

    # --- Task volume series (created_at) ---
    if vr == "24h":
        vol_start = now - timedelta(hours=24)
    elif vr == "7d":
        vol_start = now - timedelta(days=7)
    elif vr == "30d":
        vol_start = now - timedelta(days=30)
    else:
        vol_start = now - timedelta(days=_ALL_RANGE_DAYS)

    tv_rows = (
        supa.table("tasks")
        .select("created_at")
        .gte("created_at", vol_start.isoformat())
        .limit(_MAX_VOLUME_TASKS)
        .execute()
    )
    task_volume = _build_task_volume(tv_rows.data or [], vr, now)

    # --- Category distribution ---
    cat_rows = supa.table("tasks").select("category").limit(_MAX_CATEGORY_ROWS).execute()
    cat_counts: dict[str, int] = {}
    for row in cat_rows.data or []:
        c = str(row.get("category") or "")
        cat_counts[c] = cat_counts.get(c, 0) + 1
    total_cat = sum(cat_counts.values())
    category_distribution: list[dict[str, Any]] = []
    if total_cat > 0:
        for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
            pct = round(100.0 * cnt / total_cat, 1)
            category_distribution.append(
                {
                    "category": cat,
                    "label": _CATEGORY_LABELS.get(cat, cat.replace("_", " ").title()),
                    "count": cnt,
                    "pct": pct,
                }
            )

    # --- Recent settlements ---
    rs = (
        supa.table("tasks")
        .select("task_id,title,settled_at,bounty_micros,category,status")
        .eq("status", "completed")
        .order("settled_at", desc=True)
        .limit(5)
        .execute()
    )
    recent_settlements: list[dict[str, Any]] = []
    for row in rs.data or []:
        recent_settlements.append(
            {
                "task_id": row.get("task_id"),
                "title": row.get("title") or "",
                "settled_at": row.get("settled_at"),
                "bounty_micros": str(_micros_int(row.get("bounty_micros"))),
                "category": row.get("category"),
            }
        )

    # --- Executor highlight (top 6 active by score) ---
    ex_rows = (
        supa.table("executors")
        .select("wallet,display_name,type,score,tasks_completed")
        .eq("active", True)
        .execute()
    )
    exec_list = list(ex_rows.data or [])
    exec_list.sort(key=lambda row: (-_sc(row), -_tc(row), str(row.get("wallet") or "")))
    executors_highlight: list[dict[str, Any]] = []
    for row in exec_list[:6]:
        w = str(row.get("wallet") or "")
        executors_highlight.append(
            {
                "display_name": row.get("display_name") or (w[:10] if w else "—"),
                "type": row.get("type"),
                "type_display": _executor_type_display(row.get("type")),
                "wallet": w,
            }
        )

    return {
        "kpis": {
            "tasks_completed": tasks_completed_total,
            "tasks_completed_delta_pct": _delta_pct(float(completed_7d), float(completed_prev_7d)),
            "active_executors": active_executors,
            "active_executors_delta_pct": None,
            "avg_completion_minutes": avg_completion,
            "avg_completion_delta_pct": avg_completion_delta_pct,
            "usdc_volume_24h_micros": str(bounty_24h),
            "usdc_volume_24h_delta_pct": _delta_pct(float(bounty_24h), float(bounty_prev_24h)),
        },
        "task_volume": task_volume,
        "volume_range": vr,
        "category_distribution": category_distribution,
        "recent_settlements": recent_settlements,
        "executors_highlight": executors_highlight,
    }


def _build_task_volume(rows: list[dict], vr: str, now: datetime) -> list[dict[str, Any]]:
    """Bucket `created_at` for chart: hourly (24h) or daily (7d / 30d / all)."""
    events: list[datetime] = []
    for r in rows:
        dt = _parse_ts(r.get("created_at"))
        if dt is None:
            continue
        events.append(dt.astimezone(UTC) if dt.tzinfo else dt.replace(tzinfo=UTC))

    now_u = now.astimezone(UTC)

    if vr == "24h":
        start_h = (now_u - timedelta(hours=23)).replace(minute=0, second=0, microsecond=0)
        out: list[dict[str, Any]] = []
        for i in range(24):
            lo = start_h + timedelta(hours=i)
            hi = lo + timedelta(hours=1)
            cnt = sum(1 for dt in events if lo <= dt < hi)
            out.append(
                {
                    "date": lo.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    "label": lo.strftime("%H:%M"),
                    "count": cnt,
                }
            )
        return out

    if vr == "7d":
        start_d = (now_u - timedelta(days=7)).date()
    elif vr == "30d":
        start_d = (now_u - timedelta(days=30)).date()
    else:
        start_d = (now_u - timedelta(days=_ALL_RANGE_DAYS)).date()
    end_d = now_u.date()
    days: list[date] = []
    day_cur = start_d
    while day_cur <= end_d:
        days.append(day_cur)
        day_cur = day_cur + timedelta(days=1)

    out_d: list[dict[str, Any]] = []
    for day in days:
        cnt = sum(1 for dt in events if dt.astimezone(UTC).date() == day)
        iso = day.isoformat()
        if vr in ("30d", "all"):
            label = datetime.combine(day, datetime.min.time(), tzinfo=UTC).strftime("%b %d")
        else:
            label = datetime.combine(day, datetime.min.time(), tzinfo=UTC).strftime("%a")
        out_d.append({"date": iso, "label": label, "count": cnt})
    return out_d
