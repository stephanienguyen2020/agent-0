"""Orchestrate L1 → L2 → L3 → L4."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from verifier.levels.level1_auto import run_level1
from verifier.levels.level2_dgrid import run_level2 as run_level2_dgrid
from verifier.levels.level2_dgrid_x402 import run_level2 as run_level2_dgrid_x402
from verifier.levels.level2_gemini import run_level2 as run_level2_gemini
from verifier.levels.level3_agent import run_level3
from verifier.levels.level4_arbitration import run_level4


@dataclass
class PipelineResult:
    passed: bool
    final_level: str
    reason: str
    details: dict[str, Any]


def run(
    category: str,
    evidence: dict[str, Any],
    gemini_api_key: str | None = None,
    *,
    l2_provider: str = "gemini",
    dgrid_api_key: str | None = None,
    dgrid_base_url: str = "https://api.dgrid.ai/v1",
    dgrid_verify_model: str = "openai/gpt-4o",
    dgrid_x402_url: str = "https://api.dgrid.ai/x402/v1",
    dgrid_x402_payment_header: str | None = None,
    dgrid_x402_private_key: str | None = None,
) -> PipelineResult:
    l1 = run_level1(category, evidence)
    if not l1.passed:
        return PipelineResult(False, "l1_auto", l1.reason, {"l1": l1.details})

    prov = (l2_provider or "gemini").strip().lower()
    if prov == "dgrid_x402":
        l2 = run_level2_dgrid_x402(
            category,
            evidence,
            x402_url=dgrid_x402_url,
            model=dgrid_verify_model,
            payment_header=dgrid_x402_payment_header,
            private_key_hex=dgrid_x402_private_key,
        )
    elif prov == "dgrid":
        l2 = run_level2_dgrid(
            category,
            evidence,
            api_key=dgrid_api_key,
            base_url=dgrid_base_url,
            model=dgrid_verify_model,
        )
    else:
        l2 = run_level2_gemini(category, evidence, api_key=gemini_api_key)
    if not l2.passed:
        return PipelineResult(False, "l2_ai", l2.reason, {"l1": l1.details, "l2": l2.details})

    if l2.confidence is not None and 0.6 <= l2.confidence < 0.8:
        l3 = run_level3(evidence)
        if not l3.passed:
            return PipelineResult(False, "l3_agent", l3.reason, {"l3": l3.details})

    l4 = run_level4()
    if l4.needs_human:
        return PipelineResult(False, "l4_arbitration", "needs_human", {"l4": l4.details})

    return PipelineResult(True, "l2_ai", "ok", {"l1": l1.details, "l2": l2.details})
