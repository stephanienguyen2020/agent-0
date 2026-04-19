"""Release escrow for verified tasks (Settlement worker)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from em_api.services.chain import ChainService
from em_api.services.verification_ops import record_completion_reputation


def settle_one_verified_task(
    *,
    supa: Any,
    chain: ChainService,
    task_id: str,
) -> dict[str, Any]:
    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        return {"ok": False, "error": "task not found"}
    task = tr.data
    if task.get("status") != "verified":
        return {"ok": False, "skipped": True, "reason": "not verified"}
    txr = chain.release(task_id)
    chain.wait_for_transaction(txr)
    now = datetime.now(timezone.utc).isoformat()
    supa.table("tasks").update(
        {
            "status": "completed",
            "settled_at": now,
            "on_chain_tx_release": txr,
        }
    ).eq("task_id", task_id).execute()
    record_completion_reputation(supa, task_id, task, txr or "")
    return {"ok": True, "on_chain_tx_release": txr}
