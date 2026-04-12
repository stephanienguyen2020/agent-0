"""Per-category evidence validation (verification pipeline L1 partial)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

Category = Literal[
    "physical_presence",
    "knowledge_access",
    "human_authority",
    "simple_action",
    "digital_physical",
]


class EvidencePhysicalPresence(BaseModel):
    photo_urls: list[str] = Field(min_length=1)
    gps_lat: float | None = None
    gps_lng: float | None = None
    taken_at: str | None = None


class EvidenceKnowledgeAccess(BaseModel):
    document_url: str
    summary: str | None = None


class EvidenceHumanAuthority(BaseModel):
    scan_url: str
    notary_id: str | None = None


class EvidenceSimpleAction(BaseModel):
    photo_urls: list[str] = Field(min_length=1)
    action_type: str


class EvidenceDigitalPhysical(BaseModel):
    bridge_tx_hash: str
    proof_url: str | None = None


_SCHEMAS: dict[str, type[BaseModel]] = {
    "physical_presence": EvidencePhysicalPresence,
    "knowledge_access": EvidenceKnowledgeAccess,
    "human_authority": EvidenceHumanAuthority,
    "simple_action": EvidenceSimpleAction,
    "digital_physical": EvidenceDigitalPhysical,
}


def validate_evidence(category: str, payload: dict[str, Any]) -> None:
    model = _SCHEMAS.get(category)
    if not model:
        raise ValueError(f"unknown category {category}")
    try:
        model.model_validate(payload)
    except ValidationError as e:
        raise ValueError(str(e)) from e
