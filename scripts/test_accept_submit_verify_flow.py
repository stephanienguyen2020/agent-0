#!/usr/bin/env python3
"""
End-to-end lifecycle: publish (x402) → accept → multipart submit evidence → verify (pipeline + release).

Preconditions
-----------
1. FastAPI + facilitator + Supabase (same as test_publish_task_flow.py).
2. For **accept** without World ID in the browser, set **WORLD_ID_ACCEPT_ENFORCE=false** in repo-root
   `.env` and restart the API (or complete `/register` for the executor wallet).
3. **PUBLISH_TEST_REQUESTER_PRIVATE_KEY** — funds EIP-3009 for publish.
4. **ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY** — executor wallet for `POST .../accept` (defaults to
   **PUBLISH_TEST_REQUESTER_PRIVATE_KEY** if unset so one wallet can publish and accept in demos).

Canonical run::

    cd backend && source .venv/bin/activate && PYTHONPATH=. python ../scripts/test_accept_submit_verify_flow.py

Never logs private keys.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import secrets
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from dotenv import load_dotenv

load_dotenv(REPO_ROOT / ".env")

from eth_account import Account
from web3 import Web3

from em_api.services.x402_signer import sign_transfer_with_authorization

# 1×1 transparent PNG (minimal valid file for multipart evidence).
_MINIMAL_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)


def _http_json(
    method: str,
    url: str,
    *,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    raw_body: bytes | None = None,
    timeout: int = 180,
) -> dict[str, Any]:
    hdrs = dict(headers or {})
    data: bytes | None = None
    if raw_body is not None:
        data = raw_body
    elif body is not None:
        data = json.dumps(body).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json")
    req = Request(url, data=data, method=method, headers=hdrs)
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else {}
    except HTTPError as e:
        try:
            err_body = e.read().decode("utf-8")
        except Exception:
            err_body = str(e)
        raise RuntimeError(f"HTTP {e.code} {url}: {err_body}") from e


def _multipart_submit(
    url: str,
    *,
    file_bytes: bytes,
    filename: str,
    mime: str,
    fields: dict[str, str],
    timeout: int = 180,
) -> dict[str, Any]:
    boundary = secrets.token_hex(16)
    crlf = b"\r\n"
    chunks: list[bytes] = []
    for k, v in fields.items():
        chunks.append(f"--{boundary}".encode() + crlf)
        chunks.append(f'Content-Disposition: form-data; name="{k}"'.encode() + crlf + crlf)
        chunks.append(v.encode("utf-8") + crlf)
    chunks.append(f"--{boundary}".encode() + crlf)
    disp = (
        f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode()
        + crlf
        + f"Content-Type: {mime}".encode()
        + crlf
        + crlf
    )
    chunks.append(disp)
    chunks.append(file_bytes + crlf)
    chunks.append(f"--{boundary}--".encode() + crlf)
    body = b"".join(chunks)
    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    return _http_json("POST", url, headers=headers, raw_body=body, timeout=timeout)


def _health_probe(label: str, url: str) -> None:
    try:
        _http_json("GET", url, timeout=15)
        print(f"OK: {label} ({url})", file=sys.stderr)
    except (RuntimeError, URLError, json.JSONDecodeError) as e:
        print(f"WARN: {label} ({url}): {e}", file=sys.stderr)


def _publish_task(
    *,
    base: str,
    requester_pk: str,
    bounty_usdc: float,
    category: str,
    deadline_hours: float,
    title: str,
    instructions: str,
) -> str:
    mock_usdc = os.environ.get("MOCK_USDC_ADDRESS", "").strip()
    escrow = os.environ.get("EM_ESCROW_ADDRESS", "").strip()
    if not mock_usdc or not escrow:
        raise RuntimeError("MOCK_USDC_ADDRESS and EM_ESCROW_ADDRESS must be set in .env")

    fee_data = _http_json("GET", f"{base}/api/v1/tasks/escrow-fee-bps")
    fee_bps = int(fee_data.get("fee_bps", 0))
    bounty_micros = int(round(bounty_usdc * 1_000_000))
    fee_micros = bounty_micros * fee_bps // 10_000
    total_micros = bounty_micros + fee_micros
    chain_id = int(os.environ.get("CHAIN_ID", "5611"))

    acct = Account.from_key(requester_pk)
    requester_wallet = Web3.to_checksum_address(acct.address)
    auth = sign_transfer_with_authorization(
        private_key=requester_pk,
        verifying_contract=mock_usdc,
        chain_id=chain_id,
        from_addr=requester_wallet,
        to_addr=Web3.to_checksum_address(escrow),
        value=total_micros,
    )
    x_payment = base64.standard_b64encode(
        json.dumps(auth, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")

    deadline = datetime.now(timezone.utc) + timedelta(hours=deadline_hours)
    deadline_iso = deadline.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    body = {
        "requester_wallet": requester_wallet,
        "requester_erc8004_id": 0,
        "title": title,
        "instructions": instructions,
        "category": category,
        "bounty_micros": bounty_micros,
        "deadline_at": deadline_iso,
        "evidence_schema": {},
        "executor_requirements": {},
    }
    out = _http_json(
        "POST",
        f"{base}/api/v1/tasks",
        body=body,
        headers={"X-PAYMENT": x_payment},
        timeout=180,
    )
    tid = out.get("task_id")
    if not tid:
        raise RuntimeError(f"publish returned no task_id: {out}")
    print(
        f"published task_id={tid} publish={out.get('on_chain_tx_publish')} "
        f"settle={out.get('on_chain_tx_x402_settle')}",
        file=sys.stderr,
    )
    return str(tid)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="E2E: publish → accept → submit file → verify → GET task (completed)."
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BACKEND_PUBLIC_URL", "http://127.0.0.1:8000"),
        help="FastAPI base URL",
    )
    parser.add_argument("--task-id", default="", help="Skip publish; use existing task_id")
    parser.add_argument("--bounty-usdc", type=float, default=2.0)
    parser.add_argument("--category", default="physical_presence")
    parser.add_argument("--deadline-hours", type=float, default=24.0)
    parser.add_argument("--title", default="E2E lifecycle test")
    parser.add_argument("--instructions", default="Created by scripts/test_accept_submit_verify_flow.py")
    parser.add_argument("--skip-health", action="store_true")
    parser.add_argument(
        "--gps-lat",
        default="",
        help="Optional gps_lat form field (physical_presence)",
    )
    parser.add_argument(
        "--gps-lng",
        default="",
        help="Optional gps_lng form field",
    )
    parser.add_argument(
        "--taken-at",
        default="",
        help="Optional taken_at ISO8601 string for form field",
    )
    args = parser.parse_args()

    req_pk = os.environ.get("PUBLISH_TEST_REQUESTER_PRIVATE_KEY", "").strip()
    if not req_pk:
        print("error: set PUBLISH_TEST_REQUESTER_PRIVATE_KEY in .env", file=sys.stderr)
        return 1

    ex_pk = os.environ.get("ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY", "").strip() or req_pk
    executor_wallet = Web3.to_checksum_address(Account.from_key(ex_pk).address)

    base = args.base_url.rstrip("/")

    if not args.skip_health:
        _health_probe("API", f"{base}/health")
        fac = os.environ.get("X402_FACILITATOR_URL", "").strip().rstrip("/")
        if fac:
            _health_probe("facilitator", f"{fac}/healthz")

    task_id = args.task_id.strip()
    try:
        if not task_id:
            task_id = _publish_task(
                base=base,
                requester_pk=req_pk,
                bounty_usdc=args.bounty_usdc,
                category=args.category,
                deadline_hours=args.deadline_hours,
                title=args.title,
                instructions=args.instructions,
            )

        acc = _http_json(
            "POST",
            f"{base}/api/v1/tasks/{task_id}/accept",
            body={
                "executor_wallet": executor_wallet,
                "executor_erc8004_id": 0,
            },
            timeout=120,
        )
        print(f"accept: {json.dumps(acc)}", file=sys.stderr)

        png = base64.standard_b64decode(_MINIMAL_PNG_B64)
        form_fields: dict[str, str] = {}
        if args.gps_lat:
            form_fields["gps_lat"] = args.gps_lat
        if args.gps_lng:
            form_fields["gps_lng"] = args.gps_lng
        if args.taken_at:
            form_fields["taken_at"] = args.taken_at

        sub = _multipart_submit(
            f"{base}/api/v1/tasks/{task_id}/submit",
            file_bytes=png,
            filename="evidence.png",
            mime="image/png",
            fields=form_fields,
            timeout=180,
        )
        print(f"submit: {json.dumps(sub)}", file=sys.stderr)

        ver = _http_json("POST", f"{base}/api/v1/tasks/{task_id}/verify", timeout=180)
        print(f"verify: {json.dumps(ver)}", file=sys.stderr)

        task = _http_json("GET", f"{base}/api/v1/tasks/{task_id}", timeout=30)
        status = task.get("status")
        print(json.dumps(task, indent=2, default=str))
        if status != "completed":
            print(f"error: expected status completed, got {status!r}", file=sys.stderr)
            return 1
        print("success: task status=completed", file=sys.stderr)
        return 0
    except (RuntimeError, URLError) as e:
        msg = str(e)
        print(f"error: {msg}", file=sys.stderr)
        if "403" in msg and "World ID verification required" in msg:
            print(
                "hint: set WORLD_ID_ACCEPT_ENFORCE=false in repo-root .env and restart FastAPI "
                "(or complete /register with World ID for the executor wallet).",
                file=sys.stderr,
            )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
