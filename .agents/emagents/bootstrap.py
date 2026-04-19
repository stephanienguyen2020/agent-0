"""Put `backend/` on `sys.path` so workers import `em_api` with shared settings + ChainService."""

from __future__ import annotations

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND = _REPO_ROOT / "backend"


def ensure_backend_import_path() -> Path:
    p = str(_BACKEND.resolve())
    if p not in sys.path:
        sys.path.insert(0, p)
    return _BACKEND


def repo_root() -> Path:
    return _REPO_ROOT
