"""Serve locally stored evidence files (dev placeholder uploads under /tmp/em-evidence)."""

from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from em_api.deps import get_supabase

router = APIRouter(prefix="/api/v1", tags=["evidence-files"])

_TMP_ROOT = Path("/tmp/em-evidence")


@router.get("/evidence-files/{item_id}")
def get_evidence_file(item_id: str) -> FileResponse:
    """Stream a file saved by local placeholder upload; keyed by evidence_items.id."""
    try:
        uuid.UUID(item_id)
    except ValueError as e:
        raise HTTPException(404, "invalid evidence item id") from e

    supa = get_supabase()
    if not supa:
        raise HTTPException(503, "Supabase not configured")

    ir = supa.table("evidence_items").select("id,filename,content_type,evidence_id").eq("id", item_id).single().execute()
    if not ir.data:
        raise HTTPException(404, "evidence item not found")

    row = ir.data
    evidence_id = row.get("evidence_id")
    if not evidence_id:
        raise HTTPException(404, "evidence item invalid")

    ev = supa.table("evidence").select("task_id").eq("id", str(evidence_id)).single().execute()
    if not ev.data:
        raise HTTPException(404, "evidence not found")

    task_id = str(ev.data.get("task_id") or "")
    if not task_id:
        raise HTTPException(404, "task not found")
    if "/" in task_id or ".." in task_id:
        raise HTTPException(400, "invalid task id")

    raw_name = row.get("filename") or "evidence"
    safe_name = Path(str(raw_name)).name
    if not safe_name or safe_name in (".", ".."):
        raise HTTPException(400, "invalid filename")

    try:
        root = _TMP_ROOT.resolve()
        dest = (root / task_id / safe_name).resolve()
        dest.relative_to(root)
    except ValueError as e:
        raise HTTPException(400, "invalid path") from e

    if not dest.is_file():
        raise HTTPException(404, "file not on server (expired dev upload or different host)")

    ct = row.get("content_type") or "application/octet-stream"
    return FileResponse(
        path=dest,
        media_type=str(ct),
        filename=safe_name,
    )
