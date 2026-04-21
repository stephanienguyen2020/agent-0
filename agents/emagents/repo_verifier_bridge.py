"""Bridge to repo-root `verifier` package — kept outside `emagents.verifier*` to avoid import shadowing."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any


def _repo_root() -> Path:
    env = os.environ.get("EXECUTION_MARKET_REPO_ROOT")
    if env:
        return Path(env).resolve()
    here = Path(__file__).resolve()
    for base in [here.parent, *here.parents]:
        if (base / "verifier" / "pipeline.py").is_file():
            return base
    raise RuntimeError(
        "Cannot locate repo-root `verifier` package — set EXECUTION_MARKET_REPO_ROOT "
        "or run from the Execution Market monorepo checkout."
    )


_REPO_ROOT = _repo_root()
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from verifier.pipeline import run as run_verification_pipeline  # noqa: E402


def run_pipeline(category: str, evidence: dict[str, Any], gemini_api_key: str | None, **kwargs: Any) -> Any:
    return run_verification_pipeline(category, evidence, gemini_api_key=gemini_api_key, **kwargs)
