"""Greenfield upload: local dev placeholder or tsx upload script (docs/13)."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import subprocess
from pathlib import Path

from em_api.config import settings

logger = logging.getLogger(__name__)


def _repo_root() -> Path:
    # backend/em_api/services/greenfield.py → …/backend → repo root
    return Path(__file__).resolve().parents[3]


def local_placeholder_upload(task_id: str, filename: str, data: bytes) -> tuple[str, str]:
    """Store under /tmp for dev; returns (url, sha256_hex)."""
    h = hashlib.sha256(data).hexdigest()
    base = Path("/tmp/em-evidence") / task_id
    base.mkdir(parents=True, exist_ok=True)
    dest = base / filename
    dest.write_bytes(data)
    url = f"file://{dest}"
    return url, f"0x{h}"


def public_url_for_dev(sha256_hex: str) -> str:
    return f"https://greenfield.placeholder/{settings.greenfield_bucket}/{sha256_hex}"


def upload_file_via_greenfield_script(local_path: Path, task_id: str, *, bucket: str) -> dict[str, str]:
    """
    Run scripts/upload-greenfield.ts via npm; stdout is one JSON line:
    { url, sha256, txHash, bucket, objectName }
    """
    scripts_dir = _repo_root() / "scripts"
    if not scripts_dir.is_dir():
        raise FileNotFoundError(f"Missing scripts directory: {scripts_dir}")

    env = os.environ.copy()
    if settings.greenfield_rpc_url:
        env.setdefault("GREENFIELD_RPC_URL", settings.greenfield_rpc_url)
        env.setdefault("GREENFIELD_RPC", settings.greenfield_rpc_url)
    env.setdefault("GREENFIELD_CHAIN_ID", str(settings.greenfield_chain_id))
    env.setdefault("GREENFIELD_BUCKET", bucket)
    env.setdefault("DEPLOYER_PRIVATE_KEY", env.get("DEPLOYER_PRIVATE_KEY", ""))

    cmd = [
        "npm",
        "run",
        "upload-greenfield",
        "--",
        "--file",
        str(local_path.resolve()),
        "--task-id",
        task_id,
        "--bucket",
        bucket,
    ]
    proc = subprocess.run(
        cmd,
        cwd=str(scripts_dir),
        capture_output=True,
        text=True,
        timeout=600,
        env=env,
    )
    if proc.returncode != 0:
        logger.warning("Greenfield upload script failed: %s", proc.stderr or proc.stdout)
        raise RuntimeError(proc.stderr or proc.stdout or "greenfield upload failed")

    line = proc.stdout.strip()
    if not line:
        raise RuntimeError("greenfield upload produced empty stdout")
    return json.loads(line)
