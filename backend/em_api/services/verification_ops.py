"""Shared verify pipeline + DB updates for FastAPI routes and Verifier worker."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from em_api.config import Settings
from em_api.constants import REP_COMPLETION_DELTA_SCORE, REP_DISPUTE_LOSS_DELTA_SCORE
from em_api.services.chain import ChainService
from em_api.services.verification import run_pipeline

# EMEscrow.TaskStatus (see contracts/src/EMEscrow.sol)
_ESCROW_SUBMITTED = 3
_ESCROW_VERIFIED = 4
_ESCROW_COMPLETED = 5


def evidence_dict_from_items(category: str, items: list[dict]) -> dict[str, Any]:
    ordered = sorted(items, key=lambda x: int(x.get("item_index", 0)))
    urls = [str(it.get("greenfield_url", "")) for it in ordered if it.get("greenfield_url")]
    if category == "knowledge_access":
        return {"document_url": urls[0] if urls else None}
    first = ordered[0] if ordered else {}
    lat = first.get("exif_gps_lat")
    lng = first.get("exif_gps_lng")
    ts = first.get("exif_timestamp")
    out: dict[str, Any] = {"photo_urls": urls, "gps_lat": lat, "gps_lng": lng}
    if ts is not None:
        out["taken_at"] = ts if isinstance(ts, str) else str(ts)
    return out


def record_completion_reputation(supa: Any, task_id: str, task: dict[str, Any], release_tx: str) -> None:
    executor_id = task.get("executor_id")
    if not executor_id:
        return
    category = task.get("category") or ""
    bounty_micros = int(task.get("bounty_micros") or 0)
    ex_r = (
        supa.table("executors")
        .select("erc8004_agent_id")
        .eq("id", executor_id)
        .single()
        .execute()
    )
    if not ex_r.data:
        return
    erc = ex_r.data["erc8004_agent_id"]
    existing = (
        supa.table("reputation_events")
        .select("id")
        .eq("source_task_id", task_id)
        .eq("event_type", "completion")
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    supa.table("reputation_events").insert(
        {
            "executor_id": executor_id,
            "erc8004_agent_id": erc,
            "event_type": "completion",
            "delta_score": REP_COMPLETION_DELTA_SCORE,
            "source_task_id": task_id,
            "source_category": category,
            "earned_micros": bounty_micros,
            "on_chain_tx": release_tx or "",
        }
    ).execute()


def record_dispute_loss_reputation(supa: Any, task_id: str, task: dict[str, Any], tx_hash: str) -> None:
    """One dispute_loss per task (idempotent); executor loses escrow dispute to requester."""
    executor_id = task.get("executor_id")
    if not executor_id:
        return
    category = task.get("category") or ""
    existing = (
        supa.table("reputation_events")
        .select("id")
        .eq("source_task_id", task_id)
        .eq("event_type", "dispute_loss")
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    ex_r = (
        supa.table("executors")
        .select("erc8004_agent_id")
        .eq("id", executor_id)
        .single()
        .execute()
    )
    if not ex_r.data:
        return
    erc = ex_r.data["erc8004_agent_id"]
    supa.table("reputation_events").insert(
        {
            "executor_id": executor_id,
            "erc8004_agent_id": erc,
            "event_type": "dispute_loss",
            "delta_score": REP_DISPUTE_LOSS_DELTA_SCORE,
            "source_task_id": task_id,
            "source_category": category,
            "earned_micros": 0,
            "on_chain_tx": tx_hash or "",
        }
    ).execute()


def process_verify_for_task(
    *,
    supa: Any,
    chain: ChainService,
    settings: Settings,
    task_id: str,
) -> dict[str, Any]:
    """
    Run L1/L2 pipeline, markVerified; optionally release + completed + reputation.
    """
    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        return {"ok": False, "error": "task not found"}
    task = tr.data
    st = task.get("status")
    if st in ("verified", "completed"):
        return {"ok": True, "skipped": True, "status": st}

    st_lower = str(st or "").lower()
    if settings.requester_approval_before_verify and st_lower == "awaiting_requester_review":
        return {"ok": False, "error": "requester approval required"}

    category = task["category"]

    ev_row = (
        supa.table("evidence")
        .select("id")
        .eq("task_id", task_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    if not ev_row.data:
        return {"ok": False, "error": "no evidence to verify"}
    evidence_id = ev_row.data[0]["id"]
    items_r = supa.table("evidence_items").select("*").eq("evidence_id", evidence_id).execute()
    items = items_r.data or []
    ev_dict = evidence_dict_from_items(category, items)

    gemini_key = settings.gemini_api_key.strip() if settings.gemini_api_key else None
    dgrid_key = settings.dgrid_api_key.strip() if settings.dgrid_api_key else None
    x402_hdr = (settings.dgrid_x402_payment_header or "").strip() or None
    x402_pk = (settings.dgrid_x402_private_key or "").strip() or None
    pipeline = run_pipeline(
        category,
        ev_dict,
        gemini_key,
        l2_provider=settings.verify_l2_provider,
        dgrid_api_key=dgrid_key,
        dgrid_base_url=settings.dgrid_base_url,
        dgrid_verify_model=settings.dgrid_verify_model,
        dgrid_x402_url=settings.dgrid_x402_url,
        dgrid_x402_payment_header=x402_hdr,
        dgrid_x402_private_key=x402_pk,
    )
    if not pipeline.passed:
        supa.table("verifications").insert(
            {
                "task_id": task_id,
                "evidence_id": evidence_id,
                "level": pipeline.final_level,
                "passed": False,
                "confidence": None,
                "reason": pipeline.reason,
                "raw": pipeline.details,
            }
        ).execute()
        return {"ok": False, "error": f"verification failed: {pipeline.reason}"}

    on_chain_status = chain.escrow_task_status_uint(task_id)

    if on_chain_status == _ESCROW_COMPLETED:
        return {"ok": True, "skipped": True, "status": "completed"}

    txv: str | None = None
    if on_chain_status == _ESCROW_VERIFIED:
        txv = task.get("on_chain_tx_verify")
    elif on_chain_status == _ESCROW_SUBMITTED:
        txv = chain.mark_verified(task_id)
        chain.wait_for_transaction(txv)
    elif on_chain_status is None:
        return {
            "ok": False,
            "error": "could not read on-chain escrow task status (check RPC / EM_ESCROW_ADDRESS)",
        }
    else:
        return {
            "ok": False,
            "error": f"unexpected on-chain escrow status {on_chain_status}; "
            f"cannot markVerified (need Submitted={_ESCROW_SUBMITTED})",
        }

    if txv is None:
        txv = chain.latest_task_verified_tx_hash(task_id)

    now = datetime.now(timezone.utc).isoformat()
    level_db = pipeline.final_level if pipeline.final_level in (
        "l1_auto",
        "l2_ai",
        "l3_agent",
        "l4_arbitration",
    ) else "l2_ai"

    pass_exists = (
        supa.table("verifications")
        .select("id")
        .eq("task_id", task_id)
        .eq("passed", True)
        .limit(1)
        .execute()
    )
    insert_passed_row = not (pass_exists.data or [])

    if settings.verify_completes_chain:
        txr = chain.release(task_id)
        upd_completed: dict[str, Any] = {
            "status": "completed",
            "verified_at": now,
            "settled_at": now,
            "on_chain_tx_release": txr,
        }
        if txv:
            upd_completed["on_chain_tx_verify"] = txv
        supa.table("tasks").update(upd_completed).eq("task_id", task_id).execute()
        if insert_passed_row:
            supa.table("verifications").insert(
                {
                    "task_id": task_id,
                    "evidence_id": evidence_id,
                    "level": level_db,
                    "passed": True,
                    "confidence": 1.0,
                    "reason": pipeline.reason,
                    "raw": pipeline.details,
                }
            ).execute()
        record_completion_reputation(supa, task_id, task, txr or "")
        return {
            "ok": True,
            "on_chain_tx_verify": txv,
            "on_chain_tx_release": txr,
        }

    upd_verified: dict[str, Any] = {"status": "verified", "verified_at": now}
    if txv:
        upd_verified["on_chain_tx_verify"] = txv
    supa.table("tasks").update(upd_verified).eq("task_id", task_id).execute()
    if insert_passed_row:
        supa.table("verifications").insert(
            {
                "task_id": task_id,
                "evidence_id": evidence_id,
                "level": level_db,
                "passed": True,
                "confidence": 1.0,
                "reason": pipeline.reason,
                "raw": pipeline.details,
            }
        ).execute()
    return {"ok": True, "on_chain_tx_verify": txv, "on_chain_tx_release": None}
