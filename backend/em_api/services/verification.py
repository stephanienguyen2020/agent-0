"""Load repo-root `verifier` package and run the L1–L4 pipeline."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from verifier.pipeline import run as run_verification_pipeline  # noqa: E402


def run_pipeline(category: str, evidence: dict[str, Any], gemini_api_key: str | None) -> Any:
    return run_verification_pipeline(category, evidence, gemini_api_key=gemini_api_key)
