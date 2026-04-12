"""Executor registration (ERC-8004 scaffold)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1/executors", tags=["executors"])


class RegisterBody(BaseModel):
    wallet: str
    erc8004_agent_id: int
    display_name: str | None = None
    type: str = "human"


@router.post("/register")
def register_executor(body: RegisterBody) -> dict:
    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")
    w = body.wallet.lower()
    row = {
        "wallet": w,
        "erc8004_agent_id": body.erc8004_agent_id,
        "type": body.type,
        "display_name": body.display_name or w[:10],
    }
    r = supa.table("executors").upsert(row, on_conflict="erc8004_agent_id").execute()
    return {"executor": r.data[0] if r.data else row}
