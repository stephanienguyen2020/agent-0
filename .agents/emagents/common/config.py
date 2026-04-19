"""Re-export API settings after ensuring `backend/` is importable (same `.env` as FastAPI)."""

from __future__ import annotations

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import Settings, settings  # noqa: E402

__all__ = ["settings", "Settings"]
