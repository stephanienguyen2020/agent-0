"""World ID proof verification (scaffold — wire Cloud API v4)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from em_api.config import settings
from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1/world-id", tags=["world-id"])


class WorldIdVerifyBody(BaseModel):
    wallet: str
    nullifier_hash: str
    merkle_root: str
    proof: str
    verification_level: str = "device"


@router.post("/verify")
def verify_world_id(body: WorldIdVerifyBody) -> dict:
    if not settings.world_id_app_id:
        raise HTTPException(501, "World ID not configured")
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    w = body.wallet.lower()
    existing = supa.table("world_id_proofs").select("wallet").eq("nullifier_hash", body.nullifier_hash).execute()
    if existing.data:
        row_wallet = existing.data[0].get("wallet")
        if row_wallet and row_wallet != w:
            raise HTTPException(409, "nullifier already used by another wallet")
    supa.table("world_id_proofs").upsert(
        {
            "wallet": w,
            "nullifier_hash": body.nullifier_hash,
            "merkle_root": body.merkle_root,
            "verification_level": body.verification_level,
            "action": settings.world_id_action,
        },
        on_conflict="wallet",
    ).execute()
    supa.table("executors").update({"verification_level": body.verification_level}).eq("wallet", w).execute()
    return {"ok": True, "wallet": w, "verification_level": body.verification_level}
