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
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from web3 import Web3
from web3.exceptions import ContractLogicError

from em_api.config import settings
from em_api.constants import ESCROW_FEE_BPS
from em_api.deps import get_chain, get_supabase
from em_api.services.evidence_schemas import validate_evidence
from em_api.services.greenfield import (
    local_placeholder_upload,
    public_url_for_dev,
    upload_file_via_greenfield_script,
)
from em_api.services.verification_ops import (
    process_verify_for_task,
    record_completion_reputation,
    record_dispute_loss_reputation,
)
from em_api.services.chain import AcceptTaskRejected, ESCROW_TASK_STATUS_ACCEPTED, PreflightRejected
from em_api.services.task_assistant_llm import assistant_chat_turn
from em_api.services.task_draft_llm import draft_chat_gemini
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
    #: Who may accept (maps `agent` → DB `ai_agent`). Default when omitted: humans + AI agents (A2A-friendly).
    executor_types_allowed: list[str] | None = None
    #: Minimum World ID tier required of **human** executors (`tasks_eligible_for`); agents use wallet onboarding.
    min_world_id_level: str | None = None


class TaskAcceptBody(BaseModel):
    executor_wallet: str
    executor_erc8004_id: int = 0
    #: When the executor row is created on first accept, use this lane (`agent` → ai_agent).
    executor_type: Literal["human", "agent", "robot"] | None = None


class TaskSubmitBody(BaseModel):
    evidence: dict[str, Any]
    filename: str = "evidence.bin"


class TaskOpenDisputeBody(BaseModel):
    wallet: str
    reason: str = Field(min_length=3, max_length=500)


class TaskApproveEvidenceBody(BaseModel):
    wallet: str


class TaskResolveDisputeBody(BaseModel):
    executor_wins: bool
    resolution: str | None = Field(default=None, max_length=2000)


class DraftChatMessage(BaseModel):
    role: str = Field(min_length=1, max_length=32)
    content: str = Field(min_length=1, max_length=12000)


class DraftChatRequest(BaseModel):
    messages: list[DraftChatMessage] = Field(min_length=1, max_length=30)


class AssistantChatRequest(BaseModel):
    messages: list[DraftChatMessage] = Field(min_length=1, max_length=40)
    requester_wallet: str = Field(min_length=10, max_length=80)


# EMEscrow.TaskStatus enum indices (contracts/src/EMEscrow.sol)
_ESCROW_TS_SUBMITTED = 3
_ESCROW_TS_VERIFIED = 4
_ESCROW_TS_DISPUTED = 6


_TERMINAL_POST_DISPUTE = frozenset(
    {
        "completed",
        "refunded",
        "rejected",
        "expired",
        "cancelled",
    }
)


def _require_resolve_operator(x_em_resolve_key: str | None) -> None:
    expected = (settings.em_resolve_api_key or "").strip()
    if not expected:
        raise HTTPException(503, "EM_RESOLVE_API_KEY not configured")
    got = (x_em_resolve_key or "").strip()
    if not got:
        raise HTTPException(401, "missing X-EM-RESOLVE-KEY")
    if got != expected:
        raise HTTPException(403, "invalid X-EM-RESOLVE-KEY")


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


def _normalize_task_executor_types(values: list[str] | None) -> list[str]:
    """DB executor_type enum values (human | ai_agent | robot)."""
    if values is None:
        return ["human", "ai_agent"]
    out: list[str] = []
    for raw in values:
        t = raw.strip().lower()
        if t == "agent":
            t = "ai_agent"
        if t not in ("human", "ai_agent", "robot"):
            raise HTTPException(
                400,
                "executor_types_allowed entries must be human, agent, or robot",
            )
        if t not in out:
            out.append(t)
    if not out:
        raise HTTPException(400, "executor_types_allowed cannot be empty")
    return out


def _normalize_min_world_id_level(raw: str | None) -> str:
    v = (raw or "none").strip().lower()
    if v not in ("none", "device", "orb"):
        raise HTTPException(400, "min_world_id_level must be none, device, or orb")
    return v


def _accept_hint_to_executor_type(hint: str | None) -> str | None:
    if hint is None:
        return None
    h = hint.strip().lower()
    if h == "human":
        return "human"
    if h == "agent":
        return "ai_agent"
    if h == "robot":
        return "robot"
    raise HTTPException(400, "executor_type must be human, agent, or robot")


def _normalize_executor_type_for_compare(raw: object) -> str:
    """Normalize executor_type tokens from Postgres / API (`agent` → ai_agent)."""
    s = str(raw).strip().lower()
    if s == "agent":
        return "ai_agent"
    return s


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


def _ensure_executor(
    supa,
    wallet: str,
    erc_id: int,
    *,
    insert_executor_type: str | None = None,
) -> str:
    w = wallet.lower()
    r = supa.table("executors").select("id").eq("wallet", w).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    db_type = insert_executor_type or "human"
    if db_type not in ("human", "ai_agent", "robot"):
        db_type = "human"
    ins = (
        supa.table("executors")
        .insert(
            {
                "wallet": w,
                "erc8004_agent_id": erc_id,
                "type": db_type,
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


@router.get("/escrow-fee-bps")
def escrow_fee_bps(chain=Depends(get_chain)) -> dict:
    """Basis points used by deployed EMEscrow for platform fee — must match EIP-3009 signed amount."""
    live = chain.escrow_fee_bps()
    bps = live if live is not None else ESCROW_FEE_BPS
    return {"fee_bps": bps, "source": "chain" if live is not None else "default"}


@router.post("/draft-chat")
def draft_chat(body: DraftChatRequest) -> dict[str, Any]:
    """
    Turn conversational messages into a validated task draft (no chain / wallet actions).

    Requires GEMINI_API_KEY on the API server.
    """
    key = (settings.gemini_api_key or "").strip()
    if not key:
        raise HTTPException(
            503,
            "GEMINI_API_KEY is not configured on the API server; task drafting is unavailable.",
        )
    msgs: list[dict[str, str]] = []
    for m in body.messages:
        role = m.role.strip().lower()
        if role not in ("user", "assistant"):
            role = "user"
        msgs.append({"role": role, "content": m.content.strip()})
    try:
        return draft_chat_gemini(messages=msgs, api_key=key)
    except RuntimeError as e:
        raise HTTPException(502, detail=str(e)) from e


@router.post("/assistant-chat")
def assistant_chat(body: AssistantChatRequest) -> dict[str, Any]:
    """
    Unified assistant: task Q&A (tools), optional create-task draft, pending_actions for client-side txs.

    Requires GEMINI_API_KEY and Supabase. Pass the connected wallet as requester_wallet.
    """
    key = (settings.gemini_api_key or "").strip()
    if not key:
        raise HTTPException(
            503,
            "GEMINI_API_KEY is not configured on the API server; assistant is unavailable.",
        )
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    msgs: list[dict[str, str]] = []
    for m in body.messages:
        role = m.role.strip().lower()
        if role not in ("user", "assistant"):
            role = "user"
        msgs.append({"role": role, "content": m.content.strip()})
    try:
        w = Web3.to_checksum_address(body.requester_wallet.strip())
    except Exception as e:
        raise HTTPException(400, "invalid requester_wallet") from e
    try:
        return assistant_chat_turn(
            messages=msgs,
            requester_wallet=w,
            supa=supa,
            api_key=key,
        )
    except RuntimeError as e:
        raise HTTPException(502, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("")
def create_task(request: Request, body: TaskCreate, chain=Depends(get_chain)) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    agent_id = _ensure_agent(supa, body.requester_wallet, body.requester_erc8004_id)
    exec_allow = _normalize_task_executor_types(body.executor_types_allowed)
    mw_level = _normalize_min_world_id_level(body.min_world_id_level)
    task_id = "tk_" + uuid.uuid4().hex
    fee_bps_live = chain.escrow_fee_bps()
    fee_bps = fee_bps_live if fee_bps_live is not None else ESCROW_FEE_BPS
    fee = body.bounty_micros * fee_bps // 10_000
    total_micros = body.bounty_micros + fee
    deadline = body.deadline_at
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    deadline_unix = int(deadline.timestamp())

    # x402 path: settle EIP-3009 then publishTaskX402 (USDC already in escrow).
    # When X402_ENFORCE is false (default), still honor an X-PAYMENT header so the signed
    # frontend works; otherwise we fall back to publishTask which does transferFrom(requester)
    # and reverts unless the requester has approved MockUSDC to the escrow.
    skip_payment_dev = (
        settings.environment == "development" and request.headers.get("X-PAYMENT-SKIP") == "1"
    )
    has_x_payment = bool(request.headers.get("X-PAYMENT"))
    use_x402 = not skip_payment_dev and (settings.x402_enforce or has_x_payment)

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
            # 503: upstream settlement service unavailable (connection refused if not running).
            detail = (
                f"facilitator unreachable ({e}). "
                "Run the x402 facilitator and point X402_FACILITATOR_URL at it "
                "(from repo root: docker compose up facilitator — see facilitator/README.md)."
            )
            raise HTTPException(503, detail) from e
        x402_settle_tx = out.get("txHash")
        try:
            tx_hash = chain.publish_task_x402(
                task_id,
                body.requester_wallet,
                body.requester_erc8004_id,
                body.category,
                body.bounty_micros,
                deadline_unix,
            )
        except PreflightRejected as e:
            raise HTTPException(400, e.detail) from e
        except ContractLogicError as e:
            logger.warning("publish_task_x402 reverted: %s", e)
            raise HTTPException(
                502,
                "publishTaskX402 reverted on-chain (check deadline is in the future on opBNB; "
                "EM_AGENT_PRIVATE_KEY matches an account with EM_AGENT_ROLE on EMEscrow; "
                "signed USDC amount matches GET /api/v1/tasks/escrow-fee-bps for this bounty).",
            ) from e
    else:
        try:
            tx_hash = chain.publish_task(
                task_id,
                body.requester_wallet,
                body.requester_erc8004_id,
                body.category,
                body.bounty_micros,
                deadline_unix,
            )
        except ContractLogicError as e:
            logger.warning("publish_task reverted: %s", e)
            raise HTTPException(
                502,
                "publishTask reverted on-chain (allowance for MockUSDC → EMEscrow, deadline, or EM_AGENT_ROLE).",
            ) from e

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
        "executor_types_allowed": exec_allow,
        "min_world_id_level": mw_level,
        "location_lat": body.location_lat,
        "location_lng": body.location_lng,
        "location_radius_m": body.location_radius_m,
        "on_chain_tx_publish": tx_hash,
        "on_chain_task_id": task_id,
    }
    if x402_settle_tx:
        row["on_chain_tx_x402_settle"] = x402_settle_tx
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

    insert_et = _accept_hint_to_executor_type(body.executor_type)
    ex_id = _ensure_executor(
        supa,
        body.executor_wallet,
        body.executor_erc8004_id,
        insert_executor_type=insert_et,
    )

    ex_sel = (
        supa.table("executors")
        .select("type,verification_level,wallet_proof_verified_at")
        .eq("id", ex_id)
        .single()
        .execute()
    )
    if not ex_sel.data:
        raise HTTPException(500, "executor row missing")
    ex_meta = ex_sel.data
    etype = str(ex_meta.get("type") or "human")

    allowed_raw = task_row.get("executor_types_allowed")
    if allowed_raw is None:
        allowed_list: list[object] = ["human"]
    elif isinstance(allowed_raw, list):
        allowed_list = list(allowed_raw)
    else:
        allowed_list = [allowed_raw]
    allowed_norm = {_normalize_executor_type_for_compare(x) for x in allowed_list if x is not None}
    if etype not in allowed_norm:
        raise HTTPException(
            403,
            "executor type is not allowed for this task (see task executor_types_allowed)",
        )

    if settings.world_id_accept_enforce:
        if etype == "human":
            level = _executor_world_id_level(supa, ex_id)
            if not level:
                raise HTTPException(
                    403,
                    "World ID verification required before accepting tasks (complete /verification)",
                )
            min_w = str(task_row.get("min_world_id_level") or "none").lower()
            if min_w == "device" and level not in ("device", "orb"):
                raise HTTPException(403, "Task requires at least device-level World ID for human executors")
            if min_w == "orb" and level != "orb":
                raise HTTPException(403, "Task requires Orb-level World ID for human executors")
            if bounty_micros >= settings.world_id_orb_bounty_threshold_micros and level != "orb":
                raise HTTPException(
                    403,
                    f"Bounty ≥ ${settings.world_id_orb_bounty_threshold_micros // 1_000_000} USDC requires Orb verification",
                )
        elif etype in ("ai_agent", "robot"):
            if not ex_meta.get("wallet_proof_verified_at"):
                raise HTTPException(
                    403,
                    "Agent executor onboarding required: POST /api/v1/executors/agent-challenge then agent-verify",
                )
        else:
            raise HTTPException(403, f"unsupported executor type: {etype}")

    db_status = str(task_row.get("status") or "").strip().lower().replace(" ", "_")
    if db_status != "published":
        raise HTTPException(
            409,
            f"task cannot be accepted in status {task_row.get('status')!r} (expected published)",
        )

    chain_st = chain.escrow_task_status_uint(task_id)
    ex_cs = Web3.to_checksum_address(body.executor_wallet)

    if chain_st == ESCROW_TASK_STATUS_ACCEPTED:
        snap = chain.escrow_task_snapshot(task_id)
        if snap and Web3.to_checksum_address(snap["executor"]) == ex_cs:
            now = datetime.now(timezone.utc).isoformat()
            existing_tx = task_row.get("on_chain_tx_accept")
            supa.table("tasks").update(
                {
                    "executor_id": ex_id,
                    "status": "accepted",
                    "accepted_at": task_row.get("accepted_at") or now,
                    "on_chain_tx_accept": existing_tx,
                }
            ).eq("task_id", task_id).execute()
            return {
                "task_id": task_id,
                "on_chain_tx_accept": existing_tx,
                "reconciled": True,
            }
        raise HTTPException(
            409,
            "This task is already accepted on-chain (use the executor wallet that accepted it, or refresh if the UI is stale).",
        )

    if chain_st is not None and chain_st > ESCROW_TASK_STATUS_ACCEPTED:
        raise HTTPException(
            409,
            f"task on-chain is past the accept stage (escrow status uint={chain_st})",
        )

    try:
        tx = chain.accept_task(task_id, body.executor_wallet, body.executor_erc8004_id)
    except AcceptTaskRejected as e:
        raise HTTPException(409, e.detail) from e
    if not tx:
        raise HTTPException(503, "escrow signer not configured (EM_AGENT_PRIVATE_KEY / EM_ESCROW)")
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
    evidence: str | None = Form(None),
    file: UploadFile | None = File(None),
    gps_lat: float | None = Form(None),
    gps_lng: float | None = Form(None),
    taken_at: str | None = Form(None),
    chain=Depends(get_chain),
) -> dict:
    """Submit JSON evidence as form field `evidence` or upload a file (multipart). Optional GPS/timestamp for file uploads."""
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

        ev_payload: dict[str, Any] = {"photo_urls": [url], "gps_lat": gps_lat, "gps_lng": gps_lng}
        if taken_at:
            ev_payload["taken_at"] = taken_at
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
        item_ins: dict[str, Any] = {
            "evidence_id": evidence_id,
            "item_index": 0,
            "filename": fn,
            "content_type": ct,
            "size_bytes": len(data),
            "sha256": sha_hex[2:] if sha_hex.startswith("0x") else sha_hex,
            "greenfield_url": ev_payload.get("photo_urls", [url])[0],
        }
        if gps_lat is not None:
            item_ins["exif_gps_lat"] = gps_lat
        if gps_lng is not None:
            item_ins["exif_gps_lng"] = gps_lng
        if taken_at:
            item_ins["exif_timestamp"] = taken_at
        supa.table("evidence_items").insert(item_ins).execute()
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

    review_status = (
        "awaiting_requester_review"
        if settings.requester_approval_before_verify
        else "submitted"
    )
    supa.table("tasks").update(
        {
            "status": review_status,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "on_chain_tx_submit": tx,
        }
    ).eq("task_id", task_id).execute()

    return {"task_id": task_id, "evidence_id": evidence_id, "on_chain_tx_submit": tx}


def _evidence_dict_from_items(category: str, items: list[dict]) -> dict[str, Any]:
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


@router.post("/{task_id}/approve-evidence")
def approve_task_evidence(task_id: str, body: TaskApproveEvidenceBody) -> dict:
    """Requester-only: advance DB from awaiting_requester_review → submitted so POST /verify may run."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    if not settings.requester_approval_before_verify:
        raise HTTPException(409, "requester approval gate is disabled (REQUESTER_APPROVAL_BEFORE_VERIFY=false)")

    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task = tr.data

    st = str(task.get("status") or "").lower()
    if st != "awaiting_requester_review":
        raise HTTPException(400, "task is not awaiting requester review")

    agent_id = task.get("agent_id")
    if not agent_id:
        raise HTTPException(400, "task has no agent_id")

    ar = supa.table("agents").select("wallet").eq("id", str(agent_id)).single().execute()
    agent_wallet = (ar.data or {}).get("wallet")
    if not agent_wallet:
        raise HTTPException(400, "could not resolve requester wallet")

    w = body.wallet.strip().lower()
    if w != str(agent_wallet).lower():
        raise HTTPException(403, "wallet must be the task requester (publisher)")

    now = datetime.now(timezone.utc).isoformat()
    supa.table("tasks").update(
        {
            "status": "submitted",
            "evidence_approved_at": now,
            "updated_at": now,
        }
    ).eq("task_id", task_id).execute()

    return {"task_id": task_id, "status": "submitted", "evidence_approved_at": now}


@router.post("/{task_id}/verify")
def verify_task(task_id: str, chain=Depends(get_chain)) -> dict:
    """Run verifier pipeline (L1 + optional Gemini L2); on success settle on-chain (or verified-only if split)."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    out = process_verify_for_task(supa=supa, chain=chain, settings=settings, task_id=task_id)
    if not out.get("ok"):
        err = out.get("error") or "verify failed"
        if err == "task not found":
            raise HTTPException(404, err)
        if err == "no evidence to verify":
            raise HTTPException(400, err)
        if err == "requester approval required":
            raise HTTPException(403, err)
        raise HTTPException(422, err)
    if out.get("skipped"):
        return {
            "task_id": task_id,
            "skipped": True,
            "status": out.get("status"),
            "on_chain_tx_verify": None,
            "on_chain_tx_release": None,
        }
    return {
        "task_id": task_id,
        "on_chain_tx_verify": out.get("on_chain_tx_verify"),
        "on_chain_tx_release": out.get("on_chain_tx_release"),
    }


@router.post("/{task_id}/dispute")
def open_task_dispute(task_id: str, body: TaskOpenDisputeBody, chain=Depends(get_chain)) -> dict:
    """Participant requests escalation: API validates wallet, broadcasts `dispute(taskId, reason)` as EM_AGENT."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task = tr.data

    st = str(task.get("status") or "").lower()
    if st not in ("submitted", "verified", "awaiting_requester_review"):
        raise HTTPException(400, "task must be awaiting review, submitted, or verified to open a dispute")

    w = body.wallet.strip().lower()
    agent_id = task.get("agent_id")
    executor_id = task.get("executor_id")
    if not agent_id:
        raise HTTPException(400, "task has no agent_id")

    ar = supa.table("agents").select("wallet").eq("id", str(agent_id)).single().execute()
    agent_wallet = (ar.data or {}).get("wallet")
    if not agent_wallet:
        raise HTTPException(400, "could not resolve requester wallet")

    executor_wallet: str | None = None
    if executor_id:
        er = supa.table("executors").select("wallet").eq("id", str(executor_id)).single().execute()
        executor_wallet = (er.data or {}).get("wallet")

    raised_by: str | None = None
    if w == str(agent_wallet).lower():
        raised_by = "requester"
    elif executor_wallet and w == str(executor_wallet).lower():
        raised_by = "executor"
    else:
        raise HTTPException(403, "wallet must be the task requester or assigned executor")

    dup = (
        supa.table("disputes")
        .select("id")
        .eq("task_id", task_id)
        .in_("status", ["open", "under_review"])
        .limit(1)
        .execute()
    )
    if dup.data:
        raise HTTPException(409, "an open dispute already exists for this task")

    on_chain = chain.escrow_task_status_uint(task_id)
    if on_chain is None:
        raise HTTPException(502, "could not read on-chain escrow task status")
    if on_chain not in (_ESCROW_TS_SUBMITTED, _ESCROW_TS_VERIFIED):
        raise HTTPException(
            400,
            f"escrow task status must be Submitted ({_ESCROW_TS_SUBMITTED}) or "
            f"Verified ({_ESCROW_TS_VERIFIED}); on-chain={on_chain}",
        )

    txh = chain.dispute(task_id, body.reason.strip())
    if not txh:
        raise HTTPException(503, "EM_AGENT_PRIVATE_KEY / EM_ESCROW not configured for dispute tx")

    chain.wait_for_transaction(txh)

    now = datetime.now(timezone.utc).isoformat()
    ins = (
        supa.table("disputes")
        .insert(
            {
                "task_id": task_id,
                "raised_by": raised_by,
                "raised_by_wallet": w,
                "reason": body.reason.strip(),
                "status": "open",
            }
        )
        .execute()
    )
    dispute_row = (ins.data or [None])[0]

    supa.table("tasks").update(
        {
            "status": "disputed",
            "updated_at": now,
            "on_chain_tx_dispute": txh,
        }
    ).eq("task_id", task_id).execute()

    return {
        "task_id": task_id,
        "on_chain_tx_dispute": txh,
        "dispute_id": str(dispute_row.get("id")) if dispute_row and dispute_row.get("id") else None,
        "raised_by": raised_by,
    }


@router.post("/{task_id}/resolve-dispute")
def resolve_task_dispute(
    task_id: str,
    body: TaskResolveDisputeBody,
    chain=Depends(get_chain),
    x_em_resolve_key: str | None = Header(None, alias="X-EM-RESOLVE-KEY"),
) -> dict:
    """Operator-only: broadcast `resolveDispute(taskId, executorWins)` as EM_AGENT; settle DB + reputation."""
    _require_resolve_operator(x_em_resolve_key)

    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    tr = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not tr.data:
        raise HTTPException(404, "task not found")
    task = tr.data

    st = str(task.get("status") or "").lower()
    if st in _TERMINAL_POST_DISPUTE:
        raise HTTPException(409, "task already in a terminal state")

    if st != "disputed":
        raise HTTPException(409, "task must be disputed to resolve")

    act = (
        supa.table("disputes")
        .select("id,status")
        .eq("task_id", task_id)
        .in_("status", ["open", "under_review"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = act.data or []
    if not rows:
        raise HTTPException(409, "no active dispute row to resolve")

    dispute_id = rows[0].get("id")

    on_chain = chain.escrow_task_status_uint(task_id)
    if on_chain is None:
        raise HTTPException(502, "could not read on-chain escrow task status")
    if on_chain != _ESCROW_TS_DISPUTED:
        raise HTTPException(
            400,
            f"escrow task status must be Disputed ({_ESCROW_TS_DISPUTED}); on-chain={on_chain}",
        )

    txh = chain.resolve_dispute(task_id, body.executor_wins)
    if not txh:
        raise HTTPException(503, "EM_AGENT_PRIVATE_KEY / EM_ESCROW not configured for resolve tx")

    chain.wait_for_transaction(txh)

    now = datetime.now(timezone.utc).isoformat()
    new_d_status = "resolved_executor" if body.executor_wins else "resolved_requester"
    resolution_note = (body.resolution or "").strip() or (
        "Executor wins — funds released per dispute resolution."
        if body.executor_wins
        else "Requester wins — bounty refunded per dispute resolution."
    )

    supa.table("disputes").update(
        {
            "status": new_d_status,
            "resolution": resolution_note,
            "resolved_at": now,
        }
    ).eq("id", str(dispute_id)).execute()

    if body.executor_wins:
        supa.table("tasks").update(
            {
                "status": "completed",
                "settled_at": now,
                "updated_at": now,
                "on_chain_tx_resolve_dispute": txh,
                "on_chain_tx_release": txh,
            }
        ).eq("task_id", task_id).execute()
        record_completion_reputation(supa, task_id, task, txh)
    else:
        supa.table("tasks").update(
            {
                "status": "refunded",
                "updated_at": now,
                "on_chain_tx_resolve_dispute": txh,
                "on_chain_tx_refund": txh,
            }
        ).eq("task_id", task_id).execute()
        record_dispute_loss_reputation(supa, task_id, task, txh)

    return {
        "task_id": task_id,
        "executor_wins": body.executor_wins,
        "on_chain_tx_resolve_dispute": txh,
        "dispute_status": new_d_status,
    }


@router.get("/{task_id}")
def get_task(task_id: str) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    r = supa.table("tasks").select("*").eq("task_id", task_id).single().execute()
    if not r.data:
        raise HTTPException(404, "task not found")
    row = dict(r.data)
    row["requester_approval_before_verify"] = settings.requester_approval_before_verify
    aid = row.get("agent_id")
    if aid:
        ar = supa.table("agents").select("wallet").eq("id", str(aid)).single().execute()
        if ar.data:
            row["requester_wallet"] = ar.data.get("wallet")
    eid = row.get("executor_id")
    if eid:
        er = supa.table("executors").select("wallet").eq("id", str(eid)).single().execute()
        if er.data:
            row["executor_wallet"] = er.data.get("wallet")

    evidence_items_out: list[dict[str, Any]] = []
    ev_latest = (
        supa.table("evidence")
        .select("id")
        .eq("task_id", task_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    if ev_latest.data:
        ev_pk = ev_latest.data[0].get("id")
        if ev_pk:
            items_r = (
                supa.table("evidence_items")
                .select(
                    "item_index,filename,content_type,greenfield_url,exif_gps_lat,exif_gps_lng,exif_timestamp"
                )
                .eq("evidence_id", str(ev_pk))
                .order("item_index")
                .execute()
            )
            for it in items_r.data or []:
                url = it.get("greenfield_url")
                if not url:
                    continue
                item: dict[str, Any] = {
                    "item_index": it.get("item_index", 0),
                    "filename": it.get("filename") or "evidence",
                    "content_type": it.get("content_type") or "application/octet-stream",
                    "greenfield_url": str(url),
                }
                if it.get("exif_gps_lat") is not None:
                    item["exif_gps_lat"] = it["exif_gps_lat"]
                if it.get("exif_gps_lng") is not None:
                    item["exif_gps_lng"] = it["exif_gps_lng"]
                ts = it.get("exif_timestamp")
                if ts is not None:
                    item["exif_timestamp"] = ts if isinstance(ts, str) else str(ts)
                evidence_items_out.append(item)
    row["evidence_items"] = evidence_items_out
    return row
