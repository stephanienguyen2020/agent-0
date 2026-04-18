"""Executor registration (ERC-8004 scaffold) and public directory listing."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from web3 import Web3

from em_api.config import settings
from em_api.deps import get_supabase
from em_api.services.agent_wallet_auth import agent_executor_message_text, verify_wallet_signature

router = APIRouter(prefix="/api/v1/executors", tags=["executors"])

_TYPE_QUERY_TO_DB = {
    "human": "human",
    "agent": "ai_agent",
    "robot": "robot",
}

_DB_EXECUTOR_TYPES = frozenset({"human", "ai_agent", "robot"})


class RegisterBody(BaseModel):
    wallet: str
    erc8004_agent_id: int
    display_name: str | None = None
    type: str = "human"


class AgentChallengeBody(BaseModel):
    wallet: str
    erc8004_agent_id: int = Field(ge=0)


class AgentVerifyBody(BaseModel):
    wallet: str
    erc8004_agent_id: int = Field(ge=0)
    nonce: str = Field(min_length=16, max_length=256)
    signature: str = Field(min_length=130, max_length=300)
    type: str = Field(
        default="agent",
        description="executor lane: agent (ai_agent) or robot",
    )
    display_name: str | None = None


def _register_type_to_db(type_str: str) -> str:
    t = (type_str or "human").strip().lower()
    mapped = _TYPE_QUERY_TO_DB.get(t, t)
    if mapped not in _DB_EXECUTOR_TYPES:
        raise HTTPException(400, "type must be human, agent, or robot")
    return mapped


@router.get("")
def list_executors(
    type_filter: str | None = Query(
        None,
        alias="type",
        description="human | agent | robot (omit or all)",
    ),
    limit: int = Query(100, ge=1, le=200),
) -> dict:
    """List active executors for discovery (includes zero-task profiles). Sorted by score, then tasks completed."""
    tf = (type_filter or "").strip().lower()
    if tf and tf not in ("all", ""):
        if tf not in _TYPE_QUERY_TO_DB:
            raise HTTPException(400, "type must be human, agent, robot, or all")

    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    q = (
        supa.table("executors")
        .select(
            "id, wallet, display_name, type, score, rating_bps, tasks_completed, "
            "tasks_disputed, dispute_losses, total_earned_micros, capabilities, regions, specialties"
        )
        .eq("active", True)
    )

    if tf and tf not in ("all", ""):
        q = q.eq("type", _TYPE_QUERY_TO_DB[tf])

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

    rows.sort(key=lambda row: (-sc(row), -tc(row), str(row.get("id") or "")))
    trimmed = rows[:limit]

    out: list[dict] = []
    for row in trimmed:
        eid = row.get("id")
        out.append(
            {
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
                "capabilities": row.get("capabilities"),
                "regions": row.get("regions"),
                "specialties": row.get("specialties"),
            }
        )

    return {"executors": out}


@router.post("/register")
def register_executor(body: RegisterBody) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    w = body.wallet.lower()
    db_type = _register_type_to_db(body.type)
    row = {
        "wallet": w,
        "erc8004_agent_id": body.erc8004_agent_id,
        "type": db_type,
        "display_name": body.display_name or w[:10],
    }
    r = supa.table("executors").upsert(row, on_conflict="erc8004_agent_id").execute()
    return {"executor": r.data[0] if r.data else row}


@router.post("/agent-challenge")
def create_agent_executor_challenge(body: AgentChallengeBody) -> dict:
    """Return a nonce and exact message text the executor wallet must sign (personal_sign)."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    try:
        wchk = Web3.to_checksum_address(body.wallet.strip())
    except Exception as e:
        raise HTTPException(400, "invalid wallet address") from e

    nonce = secrets.token_hex(32)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=int(settings.agent_executor_challenge_ttl_sec))

    supa.table("agent_executor_challenges").insert(
        {
            "wallet": wchk.lower(),
            "erc8004_agent_id": body.erc8004_agent_id,
            "nonce": nonce,
            "expires_at": expires_at.isoformat(),
        }
    ).execute()

    domain = (settings.backend_public_url or "").rstrip("/")
    message = agent_executor_message_text(
        wallet_checksum=wchk,
        erc8004_agent_id=body.erc8004_agent_id,
        nonce=nonce,
        domain=domain or "execution-market",
        chain_id=settings.chain_id,
    )
    return {
        "nonce": nonce,
        "message": message,
        "expires_at": expires_at.isoformat(),
        "chain_id": settings.chain_id,
    }


@router.post("/agent-verify")
def verify_agent_executor(body: AgentVerifyBody) -> dict:
    """Validate signature, upsert executor as ai_agent/robot, and set wallet_proof_verified_at."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    lane = body.type.strip().lower()
    if lane not in ("agent", "robot"):
        raise HTTPException(400, "type must be agent or robot for wallet onboarding")
    db_type = _TYPE_QUERY_TO_DB[lane]

    try:
        wchk = Web3.to_checksum_address(body.wallet.strip())
    except Exception as e:
        raise HTTPException(400, "invalid wallet address") from e
    wlower = wchk.lower()

    cr = (
        supa.table("agent_executor_challenges")
        .select("*")
        .eq("nonce", body.nonce)
        .eq("wallet", wlower)
        .limit(1)
        .execute()
    )
    if not cr.data:
        raise HTTPException(400, "unknown or expired nonce — request a new agent-challenge")
    ch = cr.data[0]
    exp_raw = ch.get("expires_at")
    if exp_raw:
        exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(400, "challenge expired — request a new agent-challenge")

    try:
        ch_erc = int(ch.get("erc8004_agent_id"))
    except (TypeError, ValueError):
        ch_erc = -1
    if ch_erc != body.erc8004_agent_id:
        raise HTTPException(400, "erc8004_agent_id does not match challenge")

    domain = (settings.backend_public_url or "").rstrip("/")
    message = agent_executor_message_text(
        wallet_checksum=wchk,
        erc8004_agent_id=body.erc8004_agent_id,
        nonce=body.nonce,
        domain=domain or "execution-market",
        chain_id=settings.chain_id,
    )

    sig = body.signature.strip()
    if not sig.startswith("0x"):
        sig = "0x" + sig
    if not verify_wallet_signature(wchk, message, sig):
        raise HTTPException(400, "invalid signature for message")

    verified_iso = datetime.now(timezone.utc).isoformat()
    row = {
        "wallet": wlower,
        "erc8004_agent_id": body.erc8004_agent_id,
        "type": db_type,
        "display_name": body.display_name or wlower[:10],
        "wallet_proof_verified_at": verified_iso,
    }
    ur = supa.table("executors").upsert(row, on_conflict="erc8004_agent_id").execute()

    mh = hashlib.sha256(message.encode()).hexdigest()
    supa.table("agent_wallet_proofs").insert(
        {
            "wallet": wlower,
            "erc8004_agent_id": body.erc8004_agent_id,
            "nonce": body.nonce,
            "message_hash": mh,
            "signature": sig,
            "verified_at": verified_iso,
        }
    ).execute()

    supa.table("agent_executor_challenges").delete().eq("nonce", body.nonce).execute()

    return {
        "verified": True,
        "executor": ur.data[0] if ur.data else row,
        "wallet_proof_verified_at": verified_iso,
    }
