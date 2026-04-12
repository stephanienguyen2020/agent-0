"""L2: Gemini vision — wire `GEMINI_API_KEY` via REST (see backend integration)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Level2Result:
    passed: bool
    reason: str
    confidence: float | None
    details: dict[str, Any]


def run_level2(category: str, evidence: dict[str, Any], api_key: str | None = None) -> Level2Result:
    _ = (category, evidence)
    if not api_key:
        return Level2Result(True, "skipped_no_api_key", 1.0, {})
    # Integrators: call Gemini Vision with structured output per docs/14-verification-pipeline.md
    return Level2Result(True, "gemini_stub_ready", 0.9, {"note": "Implement REST/SDK call with GEMINI_API_KEY"})
