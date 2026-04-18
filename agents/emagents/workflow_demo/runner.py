"""HTTP workflow steps for the demo (sync httpx)."""

from __future__ import annotations

import os
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


EmitFn = Callable[[dict[str, Any]], None]


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
        # --- Phase 1: executor agent onboarding ---
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

        # --- Phase 2: publish task ---
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
        emit({"phase": "publish_start", "body_preview": task_body["title"]})
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
        summary["task_id"] = task_id
        emit({"phase": "publish_done", "task_id": task_id, "tx": pub_json.get("on_chain_tx_publish")})

        if not task_id:
            raise RuntimeError("create_task: missing task_id")

        # --- Phase 3: accept ---
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
        summary["accept_tx"] = acc_json.get("on_chain_tx_accept")
        emit(
            {
                "phase": "done",
                "task_id": task_id,
                "on_chain_tx_accept": summary.get("accept_tx"),
            },
        )

    return summary


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
