"""L3: publisher agent callback (scaffold)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class Level3Result:
    passed: bool
    reason: str
    details: dict[str, Any]


def run_level3(evidence: dict[str, Any]) -> Level3Result:
    _ = evidence
    return Level3Result(True, "callback_not_configured_stub", {})
