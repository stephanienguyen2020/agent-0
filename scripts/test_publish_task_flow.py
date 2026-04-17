#!/usr/bin/env python3
"""
End-to-end publish-task flow: fetch escrow fee bps, sign EIP-3009 (MockUSDC) like the browser,
POST /api/v1/tasks with X-PAYMENT so FastAPI settles via the facilitator and calls publishTaskX402.

Preconditions
-----------
1. FastAPI running with valid Supabase (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
2. x402 facilitator reachable at X402_FACILITATOR_URL (settle returns 503 if not).
3. Requester EOA (PUBLISH_TEST_REQUESTER_PRIVATE_KEY) has a valid MockUSDC balance for the
   signed authorization; facilitator EOA has tBNB for gas.
4. EMEscrow has enough free USDC vs totalUSDCCommitted for publishTaskX402 (on-chain preflight).

Run with backend dependencies (eth_account, web3, python-dotenv) on the active Python. The
script prepends ``backend/`` to ``sys.path`` and imports ``em_api.services.x402_signer``.

Canonical invocation from repo root::

    cd backend && source .venv/bin/activate && PYTHONPATH=. python ../scripts/test_publish_task_flow.py

Alternative::

    backend/.venv/bin/python scripts/test_publish_task_flow.py

Never logs private keys.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
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


def _http_json(
    method: str,
    url: str,
    *,
    body: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    data: bytes | None = None
    hdrs = dict(headers or {})
    if body is not None:
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


def _health_probe(label: str, url: str) -> None:
    try:
        _http_json("GET", url, timeout=15)
        print(f"OK: {label} ({url})", file=sys.stderr)
    except (RuntimeError, URLError, json.JSONDecodeError) as e:
        print(f"WARN: {label} ({url}): {e}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="E2E: sign x402 X-PAYMENT and POST /api/v1/tasks (publishTaskX402 path)."
    )
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BACKEND_PUBLIC_URL", "http://127.0.0.1:8000"),
        help="FastAPI base URL (default: BACKEND_PUBLIC_URL or http://127.0.0.1:8000)",
    )
    parser.add_argument(
        "--bounty-usdc",
        type=float,
        default=2.0,
        help="Bounty in USDC (6 decimals → bounty_micros)",
    )
    parser.add_argument(
        "--category",
        default="physical_presence",
        help="Task category",
    )
    parser.add_argument(
        "--deadline-hours",
        type=float,
        default=24.0,
        help="Deadline from now (hours)",
    )
    parser.add_argument("--title", default="E2E publish test", help="Task title")
    parser.add_argument(
        "--instructions",
        default="Created by scripts/test_publish_task_flow.py",
        help="Task instructions",
    )
    parser.add_argument(
        "--skip-health",
        action="store_true",
        help="Skip GET /health and facilitator /healthz probes",
    )
    args = parser.parse_args()

    pk = os.environ.get("PUBLISH_TEST_REQUESTER_PRIVATE_KEY", "").strip()
    if not pk:
        print(
            "error: set PUBLISH_TEST_REQUESTER_PRIVATE_KEY in repo-root .env "
            "(see .env.example)",
            file=sys.stderr,
        )
        return 1

    mock_usdc = os.environ.get("MOCK_USDC_ADDRESS", "").strip()
    escrow = os.environ.get("EM_ESCROW_ADDRESS", "").strip()
    if not mock_usdc or not escrow:
        print(
            "error: MOCK_USDC_ADDRESS and EM_ESCROW_ADDRESS must be set in .env",
            file=sys.stderr,
        )
        return 1

    chain_id = int(os.environ.get("CHAIN_ID", "5611"))
    base = args.base_url.rstrip("/")

    if not args.skip_health:
        _health_probe("API", f"{base}/health")
        fac = os.environ.get("X402_FACILITATOR_URL", "").strip().rstrip("/")
        if fac:
            _health_probe("facilitator", f"{fac}/healthz")
        else:
            print(
                "WARN: X402_FACILITATOR_URL unset; POST may fail at settle",
                file=sys.stderr,
            )

    try:
        fee_data = _http_json("GET", f"{base}/api/v1/tasks/escrow-fee-bps")
    except (RuntimeError, URLError) as e:
        print(f"error: could not GET escrow-fee-bps: {e}", file=sys.stderr)
        return 1

    fee_bps = int(fee_data.get("fee_bps", 0))
    source = fee_data.get("source", "?")
    print(f"fee_bps={fee_bps} (source={source})", file=sys.stderr)

    bounty_micros = int(round(args.bounty_usdc * 1_000_000))
    if bounty_micros <= 0:
        print("error: bounty must be positive", file=sys.stderr)
        return 1
    fee_micros = bounty_micros * fee_bps // 10_000
    total_micros = bounty_micros + fee_micros
    print(
        f"bounty_micros={bounty_micros} fee_micros={fee_micros} total_micros={total_micros}",
        file=sys.stderr,
    )

    acct = Account.from_key(pk)
    requester_wallet = Web3.to_checksum_address(acct.address)

    auth = sign_transfer_with_authorization(
        private_key=pk,
        verifying_contract=mock_usdc,
        chain_id=chain_id,
        from_addr=requester_wallet,
        to_addr=Web3.to_checksum_address(escrow),
        value=total_micros,
    )
    x_payment = base64.standard_b64encode(
        json.dumps(auth, separators=(",", ":")).encode("utf-8")
    ).decode("ascii")

    deadline = datetime.now(timezone.utc) + timedelta(hours=args.deadline_hours)
    # ISO-8601 with explicit Z for UTC
    deadline_iso = deadline.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    body = {
        "requester_wallet": requester_wallet,
        "requester_erc8004_id": 0,
        "title": args.title,
        "instructions": args.instructions,
        "category": args.category,
        "bounty_micros": bounty_micros,
        "deadline_at": deadline_iso,
        "evidence_schema": {},
        "executor_requirements": {},
    }

    try:
        out = _http_json(
            "POST",
            f"{base}/api/v1/tasks",
            body=body,
            headers={"X-PAYMENT": x_payment},
            timeout=180,
        )
    except (RuntimeError, URLError) as e:
        print(f"error: POST /api/v1/tasks failed: {e}", file=sys.stderr)
        return 1

    print(json.dumps(out, indent=2))
    task_id = out.get("task_id")
    pub = out.get("on_chain_tx_publish")
    settle = out.get("on_chain_tx_x402_settle")
    print(
        f"success: task_id={task_id} on_chain_tx_publish={pub} "
        f"on_chain_tx_x402_settle={settle}",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
