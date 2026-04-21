"""Load repo-root `verifier` package and run the L1–L4 pipeline."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]


def run_pipeline(category: str, evidence: dict[str, Any], gemini_api_key: str | None, **kwargs: Any) -> Any:
    try:
        from emagents.repo_verifier_bridge import run_pipeline as _run  # noqa: PLC0415
    except ImportError:
        if str(_REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(_REPO_ROOT))
        from verifier.pipeline import run as _run_legacy  # noqa: E402

        return _run_legacy(category, evidence, gemini_api_key=gemini_api_key, **kwargs)
    else:
        return _run(category, evidence, gemini_api_key, **kwargs)
