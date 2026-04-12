from __future__ import annotations

import base64
import hashlib
import json
import logging
import mimetypes
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from web3 import Web3

from em_api.config import settings
from em_api.constants import ESCROW_FEE_BPS
from em_api.deps import get_chain, get_supabase
from em_api.services.evidence_schemas import validate_evidence
from em_api.services.greenfield import (
    local_placeholder_upload,
    public_url_for_dev,
    upload_file_via_greenfield_script,
)
from em_api.services.verification import run_pipeline
from em_api.services.x402_facilitator import settle_payment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    requester_wallet: str
    requester_erc8004_id: int = 0
    title: str
    instructions: str
    category: str
    bounty_micros: int = Field(gt=0)
    deadline_at: datetime
    evidence_schema: dict[str, Any] = Field(default_factory=dict)
    executor_requirements: dict[str, Any] = Field(default_factory=dict)
    location_lat: float | None = None
    location_lng: float | None = None
    location_radius_m: int | None = None


class TaskAcceptBody(BaseModel):
    executor_wallet: str
    executor_erc8004_id: int = 0


class TaskSubmitBody(BaseModel):
    evidence: dict[str, Any]
    filename: str = "evidence.bin"


def _fee_micros(bounty: int) -> int:
    return bounty * ESCROW_FEE_BPS // 10_000


def _validate_x402_create(auth: dict, body: TaskCreate, total_micros: int) -> None:
    if auth.get("x402Version") != 1:
        raise HTTPException(400, "invalid x402Version")
    if auth.get("scheme") != "exact":
        raise HTTPException(400, "invalid x402 scheme")
    if auth.get("network") != "opbnb-testnet":
        raise HTTPException(400, "invalid x402 network")
    if not settings.em_escrow_address or not settings.mock_usdc_address:
        raise HTTPException(503, "EM_ESCROW_ADDRESS / MOCK_USDC_ADDRESS not configured")
    esc = Web3.to_checksum_address(settings.em_escrow_address)
    pl = auth.get("payload")
    if not isinstance(pl, dict):
        raise HTTPException(400, "invalid X-PAYMENT payload")
    try:
        from_a = Web3.to_checksum_address(pl.get("from", ""))
        to_a = Web3.to_checksum_address(pl.get("to", ""))
    except ValueError as e:
        raise HTTPException(400, "invalid addresses in X-PAYMENT") from e
    if from_a != Web3.to_checksum_address(body.requester_wallet):
        raise HTTPException(400, "X-PAYMENT payload.from must match requester_wallet")
    if to_a != esc:
        raise HTTPException(400, "X-PAYMENT payload.to must be EM escrow")
    try:
        val = int(pl.get("value", 0))
    except (TypeError, ValueError) as e:
        raise HTTPException(400, "invalid X-PAYMENT value") from e
    if val != total_micros:
        raise HTTPException(
            400,
            f"X-PAYMENT value must equal bounty plus fee ({total_micros} micro USDC)",
        )


def _ensure_agent(supa, wallet: str, erc_id: int) -> str:
    w = wallet.lower()
    r = supa.table("agents").select("id").eq("wallet", w).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    ins = (
        supa.table("agents")
        .insert(
            {
                "wallet": w,
                "erc8004_agent_id": erc_id,
                "display_name": w[:10],
                "type": "ai_agent",
            }
        )
        .execute()
    )
    return ins.data[0]["id"]


def _ensure_executor(supa, wallet: str, erc_id: int) -> str:
    w = wallet.lower()
    r = supa.table("executors").select("id").eq("wallet", w).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    ins = (
        supa.table("executors")
        .insert(
            {
                "wallet": w,
                "erc8004_agent_id": erc_id,
                "type": "human",
                "display_name": w[:10],
            }
        )
        .execute()
    )
    return ins.data[0]["id"]


@router.get("")
def list_tasks(status: str | None = None) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    q = supa.table("tasks").select("*")
    if status:
        q = q.eq("status", status)
    rows = q.order("created_at", desc=True).limit(100).execute()
    return {"tasks": rows.data}


@router.post("")
def create_task(request: Request, body: TaskCreate, chain=Depends(get_chain)) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    agent_id = _ensure_agent(supa, body.requester_wallet, body.requester_erc8004_id)
    task_id = "tk_" + uuid.uuid4().hex
    fee = _fee_micros(body.bounty_micros)
    total_micros = body.bounty_micros + fee
    deadline = body.deadline_at
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    deadline_unix = int(deadline.timestamp())

    use_x402 = settings.x402_enforce and not (
        settings.environment == "development" and request.headers.get("X-PAYMENT-SKIP") == "1"
    )
    x402_settle_tx: str | None = None
    if use_x402:
        raw = request.headers.get("X-PAYMENT")
        if not raw:
            raise HTTPException(402, "X-PAYMENT header required")
        try:
            auth = json.loads(base64.standard_b64decode(raw))
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(400, "invalid X-PAYMENT (expected base64 JSON)") from e
        _validate_x402_create(auth, body, total_micros)
        try:
            out = settle_payment(auth)
        except RuntimeError as e:
            raise HTTPException(503, str(e)) from e
        except httpx.HTTPStatusError as e:
            raise HTTPException(502, e.response.text) from e
        except httpx.RequestError as e:
            raise HTTPException(502, f"facilitator unreachable: {e}") from e
        x402_settle_tx = out.get("txHash")
        tx_hash = chain.publish_task_x402(
            task_id,
            body.requester_wallet,
            body.requester_erc8004_id,
            body.category,
            body.bounty_micros,
            deadline_unix,
        )
    else:
        tx_hash = chain.publish_task(
            task_id,
            body.requester_wallet,
            body.requester_erc8004_id,
            body.category,
            body.bounty_micros,
            deadline_unix,
        )

    row = {
        "task_id": task_id,
        "agent_id": agent_id,
        "category": body.category,
        "title": body.title,
        "instructions": body.instructions,
        "bounty_micros": str(body.bounty_micros),
        "fee_micros": str(fee),
        "status": "published",
        "deadline_at": deadline.isoformat(),
        "evidence_schema": body.evidence_schema,
        "executor_requirements": body.executor_requirements,
        "location_lat": body.location_lat,
        "location_lng": body.location_lng,
        "location_radius_m": body.location_radius_m,
        "on_chain_tx_publish": tx_hash,
        "on_chain_task_id": task_id,
    }
    supa.table("tasks").insert(row).execute()
    resp: dict = {"task_id": task_id, "on_chain_tx_publish": tx_hash}
    if x402_settle_tx:
        resp["on_chain_tx_x402_settle"] = x402_settle_tx
    return resp


def _executor_world_id_level(supa, executor_id: str) -> str | None:
    r = supa.table("executors").select("verification_level").eq("id", executor_id).single().execute()
    if not r.data:
        return None
    v = r.data.get("verification_level")
    if v is None:
        return None
    s = str(v).lower()
    if s in ("", "none"):
        return None
    return s


@router.post("/{task_id}/accept")
def accept_task(task_id: str, body: TaskAcceptBody, chain=Depends(get_chain)) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task_row = tr.data
    bounty_micros = int(task_row.get("bounty_micros") or 0)

    ex_id = _ensure_executor(supa, body.executor_wallet, body.executor_erc8004_id)
    if settings.world_id_accept_enforce:
        level = _executor_world_id_level(supa, ex_id)
        if not level:
            raise HTTPException(
                403,
                "World ID verification required before accepting tasks (complete /register)",
            )
        if bounty_micros >= settings.world_id_orb_bounty_threshold_micros and level != "orb":
            raise HTTPException(
                403,
                f"Bounty ≥ ${settings.world_id_orb_bounty_threshold_micros // 1_000_000} USDC requires Orb verification",
            )
    tx = chain.accept_task(task_id, body.executor_wallet, body.executor_erc8004_id)
    now = datetime.now(timezone.utc).isoformat()
    supa.table("tasks").update(
        {
            "executor_id": ex_id,
            "status": "accepted",
            "accepted_at": now,
            "on_chain_tx_accept": tx,
        }
    ).eq("task_id", task_id).execute()
    return {"task_id": task_id, "on_chain_tx_accept": tx}


@router.post("/{task_id}/submit")
async def submit_task(
    task_id: str,
    evidence: str | None = None,
    file: UploadFile | None = File(None),
    chain=Depends(get_chain),
) -> dict:
    """Submit JSON evidence as form field `evidence` or upload a file."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task = tr.data
    category = task["category"]

    if file is not None:
        data = await file.read()
        fn = file.filename or "upload"
        sha_hex = "0x" + hashlib.sha256(data).hexdigest()
        url: str
        stored_bucket = "local"

        if settings.use_greenfield_upload:
            suffix = Path(fn).suffix or ".bin"
            tmp_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                    tmp.write(data)
                    tmp_path = Path(tmp.name)
                gf = upload_file_via_greenfield_script(
                    tmp_path, task_id, bucket=settings.greenfield_bucket
                )
                url = gf["url"]
                sha_hex = gf.get("sha256", sha_hex)
                stored_bucket = settings.greenfield_bucket
            except Exception as e:
                logger.warning("Greenfield upload failed, using local placeholder: %s", e)
                url, _ = local_placeholder_upload(task_id, fn, data)
                stored_bucket = "local"
            finally:
                if tmp_path is not None:
                    tmp_path.unlink(missing_ok=True)
        else:
            url, _ = local_placeholder_upload(task_id, fn, data)
            stored_bucket = "local"

        ev_payload = {"photo_urls": [url], "gps_lat": None, "gps_lng": None}
    else:
        if not evidence:
            raise HTTPException(422, "evidence JSON or file required")
        try:
            ev_payload = json.loads(evidence)
        except json.JSONDecodeError as e:
            raise HTTPException(422, f"invalid evidence json: {e}") from e
        canon = json.dumps(ev_payload, sort_keys=True).encode()
        sha_hex = "0x" + hashlib.sha256(canon).hexdigest()
        url = public_url_for_dev(sha_hex)
        stored_bucket = "placeholder"

    try:
        validate_evidence(category, ev_payload)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    executor_id = task.get("executor_id")
    if not executor_id:
        raise HTTPException(400, "task not accepted")

    tx = chain.submit_evidence(task_id, sha_hex, url)

    ev = (
        supa.table("evidence")
        .insert(
            {
                "task_id": task_id,
                "executor_id": executor_id,
                "aggregate_sha256": sha_hex,
                "greenfield_bucket": stored_bucket,
                "on_chain_tx_submit": tx,
            }
        )
        .execute()
    )
    evidence_id = ev.data[0]["id"]

    if file is not None:
        ct = file.content_type or mimetypes.guess_type(fn)[0] or "application/octet-stream"
        supa.table("evidence_items").insert(
            {
                "evidence_id": evidence_id,
                "item_index": 0,
                "filename": fn,
                "content_type": ct,
                "size_bytes": len(data),
                "sha256": sha_hex[2:] if sha_hex.startswith("0x") else sha_hex,
                "greenfield_url": ev_payload.get("photo_urls", [url])[0],
            }
        ).execute()
    else:
        photo_urls = ev_payload.get("photo_urls") or []
        doc_url = ev_payload.get("document_url")
        urls = photo_urls if photo_urls else ([doc_url] if doc_url else [])
        for i, u in enumerate(urls):
            if not u:
                continue
            supa.table("evidence_items").insert(
                {
                    "evidence_id": evidence_id,
                    "item_index": i,
                    "filename": f"evidence_{i}",
                    "content_type": "application/octet-stream",
                    "size_bytes": 0,
                    "sha256": sha_hex[2:] if sha_hex.startswith("0x") else sha_hex,
                    "greenfield_url": str(u),
                }
            ).execute()

    supa.table("tasks").update(
        {"status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat(), "on_chain_tx_submit": tx}
    ).eq("task_id", task_id).execute()

    return {"task_id": task_id, "evidence_id": evidence_id, "on_chain_tx_submit": tx}


def _evidence_dict_from_items(category: str, items: list[dict]) -> dict[str, Any]:
    ordered = sorted(items, key=lambda x: int(x.get("item_index", 0)))
    urls = [str(it.get("greenfield_url", "")) for it in ordered if it.get("greenfield_url")]
    if category == "knowledge_access":
        return {"document_url": urls[0] if urls else None}
    return {"photo_urls": urls, "gps_lat": None, "gps_lng": None}


@router.post("/{task_id}/verify")
def verify_task(task_id: str, chain=Depends(get_chain)) -> dict:
    """Run verifier pipeline (L1 + optional Gemini L2); on success settle on-chain."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task = tr.data
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
        raise HTTPException(400, "no evidence to verify")
    evidence_id = ev_row.data[0]["id"]
    items_r = supa.table("evidence_items").select("*").eq("evidence_id", evidence_id).execute()
    items = items_r.data or []
    ev_dict = _evidence_dict_from_items(category, items)

    gemini_key = settings.gemini_api_key.strip() if settings.gemini_api_key else None
    pipeline = run_pipeline(category, ev_dict, gemini_key)
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
        raise HTTPException(422, f"verification failed: {pipeline.reason}")

    txv = chain.mark_verified(task_id)
    txr = chain.release(task_id)
    now = datetime.now(timezone.utc).isoformat()
    supa.table("tasks").update(
        {
            "status": "completed",
            "verified_at": now,
            "settled_at": now,
            "on_chain_tx_release": txr,
        }
    ).eq("task_id", task_id).execute()
    level_db = pipeline.final_level if pipeline.final_level in (
        "l1_auto",
        "l2_ai",
        "l3_agent",
        "l4_arbitration",
    ) else "l2_ai"
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
    return {"task_id": task_id, "on_chain_tx_verify": txv, "on_chain_tx_release": txr}


@router.get("/{task_id}")
def get_task(task_id: str) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    r = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not r.data:
        raise HTTPException(404, "task not found")
    return r.data
