"""World ID: forward IDKit results to World Developer API, persist proofs."""

from __future__ import annotations

import logging
from typing import Any, Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from em_api.config import settings
from em_api.deps import get_supabase
from em_api.services.world_id_signal import world_id_signal_digest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/world-id", tags=["world-id"])

WORLD_VERIFY_V4 = "https://developer.worldcoin.org/api/v4/verify"
WORLD_VERIFY_V2 = "https://developer.worldcoin.org/api/v2/verify"


class WorldIdVerifyBody(BaseModel):
    wallet: str
    idkit_result: dict[str, Any] = Field(default_factory=dict)
    # Legacy (no full IDKit payload): optional direct v2 fields
    merkle_root: str | None = None
    nullifier_hash: str | None = None
    proof: str | None = None
    verification_level: Literal["device", "orb"] = "device"


def _executor_level_from_identifier(identifier: str) -> str:
    ident = (identifier or "").lower()
    if ident == "orb":
        return "orb"
    return "device"


def _first_response_item(result: dict[str, Any]) -> dict[str, Any] | None:
    responses = result.get("responses")
    if not responses or not isinstance(responses, list):
        return None
    item = responses[0]
    return item if isinstance(item, dict) else None


@router.get("/status")
def world_id_status(wallet: str) -> dict[str, Any]:
    """Return persisted World ID verification level from `world_id_proofs` (if any)."""
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    w = wallet.strip().lower()
    if not w:
        raise HTTPException(422, "wallet is required")
    r = supa.table("world_id_proofs").select("verification_level").eq("wallet", w).limit(1).execute()
    base: dict[str, Any] = {
        "orb_bounty_threshold_micros": settings.world_id_orb_bounty_threshold_micros,
        "world_id_accept_enforce": settings.world_id_accept_enforce,
    }
    if not r.data:
        base["verification_level"] = None
        return base
    lvl = r.data[0].get("verification_level")
    base["verification_level"] = lvl
    return base


@router.post("/verify")
async def verify_world_id(body: WorldIdVerifyBody) -> dict:
    if not settings.world_id_app_id and not settings.world_id_rp_id:
        raise HTTPException(501, "World ID not configured (WORLD_ID_APP_ID or WORLD_ID_RP_ID)")
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    w = body.wallet.lower()
    verified_level: str = body.verification_level
    nullifier: str | None = None
    merkle_root: str | None = None

    if body.idkit_result:
        item = _first_response_item(body.idkit_result)
        if item:
            verified_level = _executor_level_from_identifier(str(item.get("identifier", "")))
            nullifier = item.get("nullifier") or item.get("nullifier_hash")
            merkle_root = item.get("merkle_root")
            if body.idkit_result.get("protocol_version") == "4.0" and item.get("proof"):
                proof = item.get("proof")
                if isinstance(proof, list) and len(proof) >= 5:
                    merkle_root = proof[-1]

        protocol_version = body.idkit_result.get("protocol_version")
        # IDKit 3.x/4.x payloads must use Developer API v4 with RP; v2 fallback is invalid for these proofs.
        if protocol_version in ("3.0", "4.0") and not settings.world_id_rp_id:
            raise HTTPException(
                503,
                "WORLD_ID_RP_ID must be set on the API for IDKit 3.x/4.x proofs. "
                "Add WORLD_ID_RP_ID to the repo root .env or backend/.env (same value as in frontend/.env). "
                "Without it, verification incorrectly used the v2 endpoint and World returned errors such as invalid_action.",
            )

        if settings.world_id_rp_id:
            url = f"{WORLD_VERIFY_V4}/{settings.world_id_rp_id}"
            payload = body.idkit_result
        else:
            if not item or not nullifier:
                raise HTTPException(422, "Could not parse IDKit result for legacy verify")
            url = f"{WORLD_VERIFY_V2}/{settings.world_id_app_id}"
            sig_digest = world_id_signal_digest(body.wallet)
            proof_val = item.get("proof")
            proof_str = proof_val if isinstance(proof_val, str) else ""
            mr = merkle_root or item.get("merkle_root") or ""
            payload = {
                "merkle_root": mr,
                "nullifier_hash": nullifier,
                "proof": proof_str,
                "verification_level": verified_level,
                "action": settings.world_id_action,
                "signal_hash": sig_digest,
            }

        async with httpx.AsyncClient(timeout=30.0) as http:
            r = await http.post(url, json=payload)
        try:
            data = r.json()
        except Exception:
            logger.warning("World ID non-JSON response: %s", r.text[:500])
            raise HTTPException(502, "World ID verify returned invalid response") from None

        if r.status_code != 200:
            raise HTTPException(400, f"World ID HTTP {r.status_code}: {data}")
        if "success" in data and data.get("success") is not True:
            raise HTTPException(400, f"World ID rejected proof: {data}")

        # v4 Developer verify already binds signal; protocol 3.x may not mirror signal_hash on responses[0].
        if item and body.wallet and not settings.world_id_rp_id:
            sh = item.get("signal_hash")
            if sh and isinstance(sh, str) and sh != "0x0":
                expected = world_id_signal_digest(body.wallet)
                if sh.lower() != expected.lower():
                    raise HTTPException(400, "signal_hash does not match wallet")

    else:
        if not settings.world_id_app_id:
            raise HTTPException(422, "WORLD_ID_APP_ID required for legacy merkle_root/nullifier_hash verify")
        if not body.nullifier_hash or not body.proof or not body.merkle_root:
            raise HTTPException(422, "merkle_root, nullifier_hash, proof required without idkit_result")
        nullifier = body.nullifier_hash
        merkle_root = body.merkle_root
        verified_level = body.verification_level
        url = f"{WORLD_VERIFY_V2}/{settings.world_id_app_id}"
        payload = {
            "merkle_root": body.merkle_root,
            "nullifier_hash": body.nullifier_hash,
            "proof": body.proof,
            "verification_level": body.verification_level,
            "action": settings.world_id_action,
            "signal_hash": world_id_signal_digest(body.wallet),
        }
        async with httpx.AsyncClient(timeout=30.0) as http:
            r = await http.post(url, json=payload)
        try:
            data = r.json()
        except Exception:
            raise HTTPException(502, "World ID verify returned invalid response") from None
        if r.status_code != 200 or not data.get("success", False):
            raise HTTPException(400, f"World ID rejected proof: {data}")

    if not nullifier:
        raise HTTPException(422, "missing nullifier after verification")

    existing = (
        supa.table("world_id_proofs").select("wallet").eq("nullifier_hash", nullifier).limit(1).execute()
    )
    if existing.data:
        row_wallet = existing.data[0].get("wallet")
        if row_wallet and str(row_wallet).lower() != w:
            raise HTTPException(409, "nullifier already used by another wallet")

    supa.table("world_id_proofs").upsert(
        {
            "wallet": w,
            "nullifier_hash": nullifier,
            "merkle_root": merkle_root or "",
            "verification_level": verified_level,
            "action": settings.world_id_action,
        },
        on_conflict="wallet",
    ).execute()
    supa.table("executors").update({"verification_level": verified_level}).eq("wallet", w).execute()

    return {
        "verified": True,
        "wallet": w,
        "verification_level": verified_level,
        "nullifier_hash": nullifier,
    }
