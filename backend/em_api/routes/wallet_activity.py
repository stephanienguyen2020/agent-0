"""Wallet activity — on-chain tx hashes from tasks for a connected wallet (requester via agents / executor via executors)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from web3 import Web3

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1", tags=["wallet"])

# Tasks whose bounty+fee remain notionally in escrow for the requester (non-terminal DB rows).
# Executor stake is out of scope for this metric (requester-published tasks only).
LOCKED_TASK_STATUSES: frozenset[str] = frozenset(
    {
        "published",
        "accepted",
        "in_progress",
        "submitted",
        "verifying",
        "verified",
        "disputed",
    }
)

_TX_FIELDS: list[tuple[str, str]] = [
    ("on_chain_tx_publish", "publish"),
    ("on_chain_tx_x402_settle", "x402_settle"),
    ("on_chain_tx_accept", "accept"),
    ("on_chain_tx_submit", "submit"),
    ("on_chain_tx_verify", "verify"),
    ("on_chain_tx_release", "release"),
    ("on_chain_tx_refund", "refund"),
]


def _role_for_kind(kind: str) -> str:
    if kind in ("publish", "x402_settle", "refund"):
        return "requester"
    return "executor"


def _bucket_for_kind(kind: str) -> str:
    """Filter buckets: spent (outflows to protocol/escrow), earned (executor payout), escrow (lifecycle / refund)."""
    if kind in ("publish", "x402_settle"):
        return "spent"
    if kind == "release":
        return "earned"
    return "escrow"


def _occurred_sort_value(raw: object) -> float:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except ValueError:
            pass
    return 0.0


@router.get("/wallet/activity")
def get_wallet_activity(
    wallet: str = Query(..., description="EVM wallet (0x…)"),
    limit: int = Query(50, ge=1, le=200),
) -> dict:
    """
    Returns denormalized activity rows (one per stored tx hash on tasks).

    Buckets for UI filters: **spent** = publish + x402_settle (requester); **earned** = release (executor);
    **escrow** = accept, submit, verify, refund (intermediate / settlement).
    Timestamps are coarse (`tasks.updated_at`); there is no per-hash time in DB.
    """
    w = wallet.strip()
    if not w:
        raise HTTPException(400, "wallet is required")
    try:
        Web3.to_checksum_address(w)
    except ValueError as e:
        raise HTTPException(400, "invalid wallet address") from e

    w_lower = w.lower()
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    ar = supa.table("agents").select("id").eq("wallet", w_lower).execute()
    agent_ids = [str(x["id"]) for x in (ar.data or [])]

    er = supa.table("executors").select("id").eq("wallet", w_lower).execute()
    executor_ids = [str(x["id"]) for x in (er.data or [])]

    if not agent_ids and not executor_ids:
        return {"wallet": w_lower, "items": []}

    select_cols = (
        "task_id,title,status,updated_at,agent_id,executor_id,"
        "on_chain_tx_publish,on_chain_tx_x402_settle,on_chain_tx_accept,on_chain_tx_submit,"
        "on_chain_tx_verify,on_chain_tx_release,on_chain_tx_refund"
    )

    by_task: dict[str, dict] = {}

    if agent_ids:
        qr = supa.table("tasks").select(select_cols).in_("agent_id", agent_ids).execute()
        for row in qr.data or []:
            tid = row.get("task_id")
            if tid:
                by_task[str(tid)] = row

    if executor_ids:
        qr = supa.table("tasks").select(select_cols).in_("executor_id", executor_ids).execute()
        for row in qr.data or []:
            tid = row.get("task_id")
            if tid:
                by_task[str(tid)] = row

    items: list[dict] = []
    for row in by_task.values():
        task_id = str(row.get("task_id") or "")
        title = row.get("title") or ""
        for col, kind in _TX_FIELDS:
            h = row.get(col)
            if not h or not str(h).strip():
                continue
            tx_hash = str(h).strip()
            kind_s = kind
            items.append(
                {
                    "id": f"{task_id}:{kind_s}",
                    "task_id": task_id,
                    "title": title,
                    "status": row.get("status"),
                    "role": _role_for_kind(kind_s),
                    "kind": kind_s,
                    "bucket": _bucket_for_kind(kind_s),
                    "tx_hash": tx_hash,
                    "occurred_at": row.get("updated_at"),
                }
            )

    items.sort(
        key=lambda it: (-_occurred_sort_value(it.get("occurred_at")), it["task_id"]),
    )
    items = items[:limit]

    return {"wallet": w_lower, "items": items}


def _micros_cell(v: object) -> int:
    if v is None:
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


@router.get("/wallet/escrow-locked")
def get_wallet_escrow_locked(
    wallet: str = Query(..., description="EVM wallet (0x…) — requester / agent wallet"),
) -> dict:
    """
    Sum **bounty_micros + fee_micros** for tasks **you published** (`agents.wallet`) whose `status`
    still indicates USDC committed in escrow (Supabase snapshot; may drift from chain briefly).

    Does **not** include executor-side balances or pending payouts.
    """
    w = wallet.strip()
    if not w:
        raise HTTPException(400, "wallet is required")
    try:
        Web3.to_checksum_address(w)
    except ValueError as e:
        raise HTTPException(400, "invalid wallet address") from e

    w_lower = w.lower()
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    ar = supa.table("agents").select("id").eq("wallet", w_lower).execute()
    agent_ids = [str(x["id"]) for x in (ar.data or [])]

    if not agent_ids:
        return {"wallet": w_lower, "locked_micros": "0", "task_count": 0}

    qr = (
        supa.table("tasks")
        .select("bounty_micros,fee_micros,status")
        .in_("agent_id", agent_ids)
        .in_("status", sorted(LOCKED_TASK_STATUSES))
        .execute()
    )
    rows = qr.data or []

    total = 0
    for row in rows:
        total += _micros_cell(row.get("bounty_micros")) + _micros_cell(row.get("fee_micros"))

    return {
        "wallet": w_lower,
        "locked_micros": str(total),
        "task_count": len(rows),
    }
