"""HTTP workflow steps for the demo (sync httpx)."""

from __future__ import annotations

import json
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct
from web3 import Web3

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402
from em_api.services.chain import _fill_gas  # noqa: E402


EmitFn = Callable[[dict[str, Any]], None]

# Default evidence for workflow_demo tasks (category `knowledge_access` from `_phase_publish`).
_DEFAULT_KNOWLEDGE_ACCESS_EVIDENCE = {
    "document_url": "https://example.com/workflow-demo-evidence.pdf",
    "summary": "workflow_demo terminal submit",
}


def _multipart_evidence_form(evidence_obj: dict[str, Any]) -> tuple[bytes, str]:
    """Build multipart body with single form field `evidence` (JSON string)."""
    boundary = secrets.token_hex(16)
    crlf = b"\r\n"
    payload = json.dumps(evidence_obj, separators=(",", ":"))
    chunks: list[bytes] = [
        f"--{boundary}".encode() + crlf,
        b'Content-Disposition: form-data; name="evidence"' + crlf + crlf,
        payload.encode("utf-8") + crlf,
        f"--{boundary}--".encode() + crlf,
    ]
    body = b"".join(chunks)
    ct = f"multipart/form-data; boundary={boundary}"
    return body, ct


def load_verify_display_config() -> WorkflowConfig:
    """Minimal config for Rich panel when running verify-only (no keys required)."""
    base = settings.backend_public_url.rstrip("/")
    skip = settings.environment == "development"
    return WorkflowConfig(
        base_url=base,
        publisher_key="",
        executor_key="",
        requester_erc8004_id=0,
        executor_erc8004_id=0,
        skip_payment=skip,
    )


# Minimal ERC-20 ABI for dev publish path: legacy `publishTask` uses `transferFrom` and needs allowance.
_ERC20_ALLOW_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "owner", "type": "address"}, {"name": "spender", "type": "address"}],
        "name": "allowance",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
    {
        "constant": False,
        "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
        "name": "approve",
        "outputs": [{"name": "", "type": "bool"}],
        "type": "function",
    },
    {
        "constant": True,
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "type": "function",
    },
]


def _ensure_mock_usdc_allowance_for_legacy_publish(
    *,
    cfg: WorkflowConfig,
    pub_acct: Any,
    pub_wallet: str,
    bounty_micros: int,
    client: httpx.Client,
    emit: EmitFn,
) -> None:
    """Dev + X-PAYMENT-SKIP uses `publishTask` (transferFrom); ensure MockUSDC allowance to EMEscrow."""
    if not cfg.skip_payment:
        return
    usdc_addr = (settings.mock_usdc_address or "").strip()
    esc_addr = (settings.em_escrow_address or "").strip()
    if not usdc_addr or not esc_addr:
        raise RuntimeError(
            "development publish with X-PAYMENT-SKIP needs MOCK_USDC_ADDRESS and EM_ESCROW_ADDRESS in .env "
            "(same as FastAPI) so the demo can approve MockUSDC → EMEscrow before POST /tasks.",
        )
    fee_res = client.get(f"{cfg.base_url}/api/v1/tasks/escrow-fee-bps")
    fee_res.raise_for_status()
    fee_bps = int(fee_res.json().get("fee_bps") or 0)
    fee_micros = bounty_micros * fee_bps // 10_000
    total_need = bounty_micros + fee_micros

    w3 = Web3(Web3.HTTPProvider(settings.opbnb_rpc_url))
    if not w3.is_connected():
        raise RuntimeError(f"cannot connect RPC at {settings.opbnb_rpc_url!r}")
    usdc_cs = Web3.to_checksum_address(usdc_addr)
    esc_cs = Web3.to_checksum_address(esc_addr)
    token = w3.eth.contract(address=usdc_cs, abi=_ERC20_ALLOW_ABI)
    bal = int(token.functions.balanceOf(pub_wallet).call())
    if bal < total_need:
        raise RuntimeError(
            f"publisher MockUSDC balance {bal} µUSDC < required {total_need} µUSDC "
            f"(bounty {bounty_micros} + fee). Mint via /wallet faucet or scripts before workflow_demo.",
        )
    cur = int(token.functions.allowance(pub_wallet, esc_cs).call())
    if cur >= total_need:
        emit(
            {
                "phase": "mock_usdc_allowance",
                "ok": True,
                "skipped_approve": True,
                "allowance": cur,
                "need_micros": total_need,
            },
        )
        return

    max_u256 = 2**256 - 1
    tx = token.functions.approve(esc_cs, max_u256).build_transaction(
        {
            "from": pub_wallet,
            "nonce": w3.eth.get_transaction_count(pub_wallet),
            "chainId": int(settings.chain_id),
        },
    )
    tx = _fill_gas(w3, tx)
    signed = pub_acct.sign_transaction(tx)
    raw = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
    if raw is None:
        raise RuntimeError("sign_transaction returned no raw_transaction")
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    st = receipt.get("status")
    ok = int(st) == 1 if st is not None else False
    emit(
        {
            "phase": "mock_usdc_allowance",
            "ok": ok,
            "skipped_approve": False,
            "approve_tx": w3.to_hex(tx_hash),
            "need_micros": total_need,
        },
    )
    if not ok:
        raise RuntimeError(f"MockUSDC approve reverted (tx {w3.to_hex(tx_hash)})")


@dataclass
class WorkflowConfig:
    base_url: str
    publisher_key: str
    executor_key: str
    requester_erc8004_id: int
    executor_erc8004_id: int
    skip_payment: bool


def load_config() -> WorkflowConfig:
    """Load keys from env (workflow-specific names with script fallbacks)."""
    pub = (
        os.getenv("WORKFLOW_DEMO_PUBLISHER_PRIVATE_KEY", "").strip()
        or os.getenv("PUBLISH_TEST_REQUESTER_PRIVATE_KEY", "").strip()
    )
    ex = (
        os.getenv("WORKFLOW_DEMO_EXECUTOR_PRIVATE_KEY", "").strip()
        or os.getenv("ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY", "").strip()
        or pub
    )
    if not pub:
        raise RuntimeError(
            "Set WORKFLOW_DEMO_PUBLISHER_PRIVATE_KEY or PUBLISH_TEST_REQUESTER_PRIVATE_KEY",
        )
    if not ex:
        raise RuntimeError("Set WORKFLOW_DEMO_EXECUTOR_PRIVATE_KEY or ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY")

    req_erc = int(os.getenv("WORKFLOW_DEMO_REQUESTER_ERC8004_ID", "0") or "0")
    if req_erc == 0:
        req_erc = settings.demo_buyer_requester_erc8004_id

    exec_erc = int(os.getenv("WORKFLOW_DEMO_EXECUTOR_ERC8004_ID", "0") or "0")
    if exec_erc == 0:
        exec_erc = settings.demo_executor_erc8004_id

    base = settings.backend_public_url.rstrip("/")
    skip = settings.environment == "development"
    return WorkflowConfig(
        base_url=base,
        publisher_key=pub,
        executor_key=ex,
        requester_erc8004_id=req_erc,
        executor_erc8004_id=exec_erc,
        skip_payment=skip,
    )


def load_publish_config() -> WorkflowConfig:
    """Publisher wallet only (two-terminal demo: Terminal 1)."""
    pub = (
        os.getenv("WORKFLOW_DEMO_PUBLISHER_PRIVATE_KEY", "").strip()
        or os.getenv("PUBLISH_TEST_REQUESTER_PRIVATE_KEY", "").strip()
    )
    if not pub:
        raise RuntimeError(
            "Publish-only: set WORKFLOW_DEMO_PUBLISHER_PRIVATE_KEY or PUBLISH_TEST_REQUESTER_PRIVATE_KEY",
        )
    req_erc = int(os.getenv("WORKFLOW_DEMO_REQUESTER_ERC8004_ID", "0") or "0")
    if req_erc == 0:
        req_erc = settings.demo_buyer_requester_erc8004_id
    exec_erc = int(os.getenv("WORKFLOW_DEMO_EXECUTOR_ERC8004_ID", "0") or "0")
    if exec_erc == 0:
        exec_erc = settings.demo_executor_erc8004_id
    base = settings.backend_public_url.rstrip("/")
    skip = settings.environment == "development"
    return WorkflowConfig(
        base_url=base,
        publisher_key=pub,
        executor_key="",
        requester_erc8004_id=req_erc,
        executor_erc8004_id=exec_erc,
        skip_payment=skip,
    )


def load_accept_config() -> WorkflowConfig:
    """Executor wallet only (two-terminal demo: Terminal 2)."""
    ex = (
        os.getenv("WORKFLOW_DEMO_EXECUTOR_PRIVATE_KEY", "").strip()
        or os.getenv("ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY", "").strip()
    )
    if not ex:
        raise RuntimeError(
            "Accept-only: set WORKFLOW_DEMO_EXECUTOR_PRIVATE_KEY or ACCEPT_FLOW_EXECUTOR_PRIVATE_KEY",
        )
    exec_erc = int(os.getenv("WORKFLOW_DEMO_EXECUTOR_ERC8004_ID", "0") or "0")
    if exec_erc == 0:
        exec_erc = settings.demo_executor_erc8004_id
    req_erc = int(os.getenv("WORKFLOW_DEMO_REQUESTER_ERC8004_ID", "0") or "0")
    if req_erc == 0:
        req_erc = settings.demo_buyer_requester_erc8004_id
    base = settings.backend_public_url.rstrip("/")
    skip = settings.environment == "development"
    return WorkflowConfig(
        base_url=base,
        publisher_key="",
        executor_key=ex,
        requester_erc8004_id=req_erc,
        executor_erc8004_id=exec_erc,
        skip_payment=skip,
    )


def _phase_agent_onboard(
    cfg: WorkflowConfig,
    exec_acct: Account,
    exec_wallet: str,
    client: httpx.Client,
    emit: EmitFn,
) -> None:
    emit({"phase": "onboard_start", "wallet": exec_wallet, "erc8004": cfg.executor_erc8004_id})
    r = client.post(
        f"{cfg.base_url}/api/v1/executors/agent-challenge",
        json={
            "wallet": exec_wallet,
            "erc8004_agent_id": cfg.executor_erc8004_id,
        },
    )
    emit(
        {
            "phase": "agent_challenge",
            "http_status": r.status_code,
            "ok": r.is_success,
        },
    )
    if not r.is_success:
        raise RuntimeError(f"agent-challenge failed: {r.status_code} {r.text}")

    ch = r.json()
    message = ch.get("message") or ""
    nonce = ch.get("nonce") or ""
    if not message:
        raise RuntimeError("agent-challenge: missing message in response")

    enc = encode_defunct(text=message)
    signed = exec_acct.sign_message(enc)
    sig = "0x" + signed.signature.hex()

    r2 = client.post(
        f"{cfg.base_url}/api/v1/executors/agent-verify",
        json={
            "wallet": exec_wallet,
            "erc8004_agent_id": cfg.executor_erc8004_id,
            "nonce": nonce,
            "signature": sig,
            "type": "agent",
            "display_name": "workflow-demo-executor",
        },
    )
    emit(
        {
            "phase": "agent_verify",
            "http_status": r2.status_code,
            "ok": r2.is_success,
        },
    )
    if not r2.is_success:
        raise RuntimeError(f"agent-verify failed: {r2.status_code} {r2.text}")

    emit({"phase": "onboard_done", "detail": r2.json() if r2.text else {}})


def _phase_publish(
    cfg: WorkflowConfig,
    pub_acct: Account,
    pub_wallet: str,
    client: httpx.Client,
    emit: EmitFn,
    headers_dev: dict[str, str],
) -> str:
    deadline = datetime.now(timezone.utc) + timedelta(days=2)
    task_body = {
        "requester_wallet": pub_wallet,
        "requester_erc8004_id": cfg.requester_erc8004_id,
        "title": "Workflow demo task (terminal)",
        "instructions": "Terminal workflow_demo: accept and optionally complete via UI later.",
        "category": "knowledge_access",
        "bounty_micros": 1_000_000,
        "deadline_at": deadline.isoformat(),
        "evidence_schema": {"document_url": "string"},
        "executor_requirements": {},
    }
    bounty_micros = int(task_body["bounty_micros"])
    emit({"phase": "publish_start", "body_preview": task_body["title"]})
    _ensure_mock_usdc_allowance_for_legacy_publish(
        cfg=cfg,
        pub_acct=pub_acct,
        pub_wallet=pub_wallet,
        bounty_micros=bounty_micros,
        client=client,
        emit=emit,
    )
    r3 = client.post(
        f"{cfg.base_url}/api/v1/tasks",
        json=task_body,
        headers=headers_dev,
    )
    emit(
        {
            "phase": "publish_task",
            "http_status": r3.status_code,
            "ok": r3.is_success,
        },
    )
    if not r3.is_success:
        raise RuntimeError(f"create_task failed: {r3.status_code} {r3.text}")
    pub_json = r3.json()
    task_id = pub_json.get("task_id")
    emit({"phase": "publish_done", "task_id": task_id, "tx": pub_json.get("on_chain_tx_publish")})

    if not task_id:
        raise RuntimeError("create_task: missing task_id")
    return str(task_id)


def _phase_accept(
    cfg: WorkflowConfig,
    exec_wallet: str,
    task_id: str,
    client: httpx.Client,
    emit: EmitFn,
) -> str | None:
    emit({"phase": "accept_start", "task_id": task_id})
    accept_body = {
        "executor_wallet": exec_wallet,
        "executor_erc8004_id": cfg.executor_erc8004_id,
        "executor_type": "agent",
    }
    r4 = client.post(
        f"{cfg.base_url}/api/v1/tasks/{task_id}/accept",
        json=accept_body,
    )
    emit(
        {
            "phase": "accept_task",
            "http_status": r4.status_code,
            "ok": r4.is_success,
        },
    )
    if not r4.is_success:
        raise RuntimeError(f"accept failed: {r4.status_code} {r4.text}")
    acc_json = r4.json()
    accept_tx = acc_json.get("on_chain_tx_accept")
    emit(
        {
            "phase": "done",
            "task_id": task_id,
            "on_chain_tx_accept": accept_tx,
        },
    )
    return accept_tx if isinstance(accept_tx, str) else None


def run_workflow(cfg: WorkflowConfig, emit: EmitFn) -> dict[str, Any]:
    """Execute onboard → publish → accept. Returns summary dict."""
    pub_acct = Account.from_key(cfg.publisher_key.strip())
    exec_acct = Account.from_key(cfg.executor_key.strip())
    pub_wallet = Web3.to_checksum_address(pub_acct.address)
    exec_wallet = Web3.to_checksum_address(exec_acct.address)

    summary: dict[str, Any] = {
        "publisher_wallet": pub_wallet,
        "executor_wallet": exec_wallet,
        "task_id": None,
    }

    headers_dev: dict[str, str] = {}
    if cfg.skip_payment:
        headers_dev["X-PAYMENT-SKIP"] = "1"

    with httpx.Client(timeout=120.0) as client:
        _phase_agent_onboard(cfg, exec_acct, exec_wallet, client, emit)
        task_id = _phase_publish(cfg, pub_acct, pub_wallet, client, emit, headers_dev)
        summary["task_id"] = task_id
        summary["accept_tx"] = _phase_accept(cfg, exec_wallet, task_id, client, emit)

    return summary


def run_publish_only(cfg: WorkflowConfig, emit: EmitFn) -> dict[str, Any]:
    """Publish task only (two-terminal demo Terminal 1). Requires load_publish_config()."""
    if not cfg.publisher_key.strip():
        raise RuntimeError("run_publish_only requires publisher_key in WorkflowConfig")
    pub_acct = Account.from_key(cfg.publisher_key.strip())
    pub_wallet = Web3.to_checksum_address(pub_acct.address)

    summary: dict[str, Any] = {
        "publisher_wallet": pub_wallet,
        "task_id": None,
    }

    headers_dev: dict[str, str] = {}
    if cfg.skip_payment:
        headers_dev["X-PAYMENT-SKIP"] = "1"

    with httpx.Client(timeout=120.0) as client:
        task_id = _phase_publish(cfg, pub_acct, pub_wallet, client, emit, headers_dev)
        summary["task_id"] = task_id

    emit({"phase": "publish_only_done", "task_id": summary["task_id"]})
    return summary


def run_accept_only(
    cfg: WorkflowConfig,
    task_id: str,
    emit: EmitFn,
    *,
    skip_onboard: bool = False,
) -> dict[str, Any]:
    """Accept task only (two-terminal demo Terminal 2). Requires load_accept_config()."""
    if not cfg.executor_key.strip():
        raise RuntimeError("run_accept_only requires executor_key in WorkflowConfig")
    tid = task_id.strip()
    if not tid:
        raise RuntimeError("run_accept_only requires non-empty task_id")

    exec_acct = Account.from_key(cfg.executor_key.strip())
    exec_wallet = Web3.to_checksum_address(exec_acct.address)

    summary: dict[str, Any] = {
        "executor_wallet": exec_wallet,
        "task_id": tid,
        "accept_tx": None,
    }

    with httpx.Client(timeout=120.0) as client:
        if not skip_onboard:
            _phase_agent_onboard(cfg, exec_acct, exec_wallet, client, emit)
        summary["accept_tx"] = _phase_accept(cfg, exec_wallet, tid, client, emit)

    return summary


def run_submit_only(cfg: WorkflowConfig, task_id: str, emit: EmitFn) -> dict[str, Any]:
    """Submit evidence (multipart JSON) for `knowledge_access` tasks. Uses executor env for summary display."""
    tid = task_id.strip()
    if not tid:
        raise RuntimeError("run_submit_only requires task_id")

    exec_wallet: str | None = None
    if cfg.executor_key.strip():
        exec_acct = Account.from_key(cfg.executor_key.strip())
        exec_wallet = Web3.to_checksum_address(exec_acct.address)

    emit({"phase": "submit_start", "task_id": tid})
    body, content_type = _multipart_evidence_form(dict(_DEFAULT_KNOWLEDGE_ACCESS_EVIDENCE))

    with httpx.Client(timeout=180.0) as client:
        r = client.post(
            f"{cfg.base_url}/api/v1/tasks/{tid}/submit",
            content=body,
            headers={"Content-Type": content_type},
        )
    emit(
        {
            "phase": "submit_task",
            "http_status": r.status_code,
            "ok": r.is_success,
        },
    )
    if not r.is_success:
        raise RuntimeError(f"submit failed: {r.status_code} {r.text}")
    sub = r.json()
    emit(
        {
            "phase": "submit_done",
            "task_id": tid,
            "on_chain_tx_submit": sub.get("on_chain_tx_submit"),
            "evidence_id": sub.get("evidence_id"),
        },
    )
    return {
        "executor_wallet": exec_wallet,
        "task_id": tid,
        "evidence_id": sub.get("evidence_id"),
        "on_chain_tx_submit": sub.get("on_chain_tx_submit"),
    }


def run_approve_only(cfg: WorkflowConfig, task_id: str, emit: EmitFn) -> dict[str, Any]:
    """Requester approves evidence (`awaiting_requester_review` → `submitted`). Requires load_publish_config()."""
    if not cfg.publisher_key.strip():
        raise RuntimeError("run_approve_only requires publisher_key (use load_publish_config)")
    tid = task_id.strip()
    if not tid:
        raise RuntimeError("run_approve_only requires task_id")

    pub_wallet = Web3.to_checksum_address(Account.from_key(cfg.publisher_key.strip()).address)
    emit({"phase": "approve_start", "task_id": tid})

    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            f"{cfg.base_url}/api/v1/tasks/{tid}/approve-evidence",
            json={"wallet": pub_wallet},
        )
    emit(
        {
            "phase": "approve_evidence",
            "http_status": r.status_code,
            "ok": r.is_success,
        },
    )
    if not r.is_success:
        raise RuntimeError(f"approve-evidence failed: {r.status_code} {r.text}")
    j = r.json()
    emit({"phase": "approve_done", "task_id": tid, "status": j.get("status")})
    return {
        "publisher_wallet": pub_wallet,
        "task_id": tid,
        "status": j.get("status"),
        "evidence_approved_at": j.get("evidence_approved_at"),
    }


def run_verify_only(base_url: str, task_id: str, emit: EmitFn) -> dict[str, Any]:
    """Run verifier pipeline + on-chain release (no wallet body)."""
    tid = task_id.strip()
    if not tid:
        raise RuntimeError("run_verify_only requires task_id")
    base = base_url.rstrip("/")
    emit({"phase": "verify_start", "task_id": tid})

    with httpx.Client(timeout=300.0) as client:
        r = client.post(f"{base}/api/v1/tasks/{tid}/verify")
    emit(
        {
            "phase": "verify_task",
            "http_status": r.status_code,
            "ok": r.is_success,
        },
    )
    if not r.is_success:
        raise RuntimeError(f"verify failed: {r.status_code} {r.text}")
    j = r.json()
    emit(
        {
            "phase": "verify_done",
            "task_id": tid,
            "on_chain_tx_verify": j.get("on_chain_tx_verify"),
            "on_chain_tx_release": j.get("on_chain_tx_release"),
            "skipped": j.get("skipped"),
        },
    )
    return {
        "task_id": tid,
        "on_chain_tx_verify": j.get("on_chain_tx_verify"),
        "on_chain_tx_release": j.get("on_chain_tx_release"),
        "skipped": j.get("skipped"),
        "status": j.get("status"),
    }


def run_approve_and_verify(cfg: WorkflowConfig, task_id: str, emit: EmitFn) -> dict[str, Any]:
    """Approve evidence then verify (Terminal 1 settlement path)."""
    ap = run_approve_only(cfg, task_id, emit)
    vf = run_verify_only(cfg.base_url, task_id, emit)
    return {
        "task_id": task_id.strip(),
        "publisher_wallet": ap.get("publisher_wallet"),
        "evidence_approved_at": ap.get("evidence_approved_at"),
        "on_chain_tx_verify": vf.get("on_chain_tx_verify"),
        "on_chain_tx_release": vf.get("on_chain_tx_release"),
        "verify_skipped": vf.get("skipped"),
    }


@dataclass
class SharedState:
    events: list[dict[str, Any]] = field(default_factory=list)
    last_error: str | None = None


def make_emitter(shared: SharedState) -> EmitFn:
    def emit(ev: dict[str, Any]) -> None:
        ev = dict(ev)
        ev.setdefault("ts", datetime.now(timezone.utc).isoformat())
        shared.events.append(ev)
        if len(shared.events) > 200:
            shared.events.pop(0)

    return emit
