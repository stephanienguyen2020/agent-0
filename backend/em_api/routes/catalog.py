"""Discovery helpers for clients that poll stable paths (e.g. GET /api/v1/catalog/rules)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from em_api.services.chain import CATEGORY_TO_UINT
from em_api.services.evidence_schemas import evidence_submit_field_names_by_category

router = APIRouter(prefix="/api/v1/catalog", tags=["catalog"])


@router.get("/rules")
def catalog_rules() -> dict[str, Any]:
    """Evidence payload field names by category + on-chain category labels; full REST surface is at `/docs`."""
    return {
        "openapi_docs": "/docs",
        "on_chain_categories": sorted(CATEGORY_TO_UINT.keys()),
        "evidence_submit_field_names_by_category": evidence_submit_field_names_by_category(),
    }
