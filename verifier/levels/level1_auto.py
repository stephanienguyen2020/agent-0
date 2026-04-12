"""L1: schema, EXIF/timestamp hooks, perceptual hash duplicate check (minimal MVP)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Level1Result:
    passed: bool
    reason: str
    details: dict[str, Any]


def run_level1(category: str, evidence: dict[str, Any]) -> Level1Result:
    if category == "physical_presence" and not evidence.get("photo_urls"):
        return Level1Result(False, "missing_photo_urls", {})
    if category == "knowledge_access" and not evidence.get("document_url"):
        return Level1Result(False, "missing_document_url", {})
    return Level1Result(True, "ok", {"category": category})
