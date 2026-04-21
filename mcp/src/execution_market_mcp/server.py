"""Stdio MCP server: tools call Execution Market FastAPI over HTTP."""

from __future__ import annotations

import json
import logging
import os
import sys
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

logger = logging.getLogger(__name__)


def _base() -> str:
    return os.environ.get("EXECUTION_MARKET_API_BASE", "http://localhost:8000").rstrip("/")


def _skip_payment_headers() -> dict[str, str]:
    if os.environ.get("EXECUTION_MARKET_X_PAYMENT_SKIP", "").strip() == "1":
        return {"X-PAYMENT-SKIP": "1"}
    return {}


mcp = FastMCP("execution-market")


@mcp.tool()
async def list_published_tasks(limit: int = 20) -> str:
    """List published marketplace tasks (GET /api/v1/tasks?status=published).

    Args:
        limit: Max rows to return (server may cap; we pass a sane default).
    """
    url = f"{_base()}/api/v1/tasks?status=published"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url)
    if not r.is_success:
        return f"HTTP {r.status_code}: {r.text[:2000]}"
    data = r.json()
    if isinstance(data, list):
        rows = data[: max(1, min(limit, 100))]
    elif isinstance(data, dict) and "tasks" in data:
        rows = (data.get("tasks") or [])[: max(1, min(limit, 100))]
    else:
        return json.dumps(data, indent=2)[:8000]
    return json.dumps(rows, indent=2)[:12000]


@mcp.tool()
async def get_task(task_id: str) -> str:
    """Fetch one task by id (GET /api/v1/tasks/{task_id}).

    Args:
        task_id: Task id (e.g. tk_…).
    """
    tid = task_id.strip()
    if not tid:
        return "task_id is required"
    url = f"{_base()}/api/v1/tasks/{tid}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.get(url)
    if not r.is_success:
        return f"HTTP {r.status_code}: {r.text[:2000]}"
    return json.dumps(r.json(), indent=2)[:12000]


@mcp.tool()
async def get_catalog_rules() -> str:
    """Discovery: on-chain categories and evidence field names (GET /api/v1/catalog/rules)."""
    url = f"{_base()}/api/v1/catalog/rules"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
    if not r.is_success:
        return f"HTTP {r.status_code}: {r.text[:2000]}"
    return json.dumps(r.json(), indent=2)[:8000]


@mcp.tool()
async def get_escrow_fee_bps() -> str:
    """Escrow fee basis points for publish math (GET /api/v1/tasks/escrow-fee-bps)."""
    url = f"{_base()}/api/v1/tasks/escrow-fee-bps"
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(url)
    if not r.is_success:
        return f"HTTP {r.status_code}: {r.text[:2000]}"
    return json.dumps(r.json(), indent=2)[:2000]


@mcp.tool()
async def create_task(
    requester_wallet: str,
    title: str,
    instructions: str,
    category: str,
    bounty_micros: int,
    deadline_at_iso: str,
    requester_erc8004_id: int = 0,
    evidence_schema_json: str = "{}",
    executor_requirements_json: str = "{}",
) -> str:
    """Create a task (POST /api/v1/tasks). Production requires EIP-3009 X-PAYMENT unless backend is in development with X-PAYMENT-SKIP.

    Args:
        requester_wallet: Checksummed or lower-case hex EVM address.
        title: Task title.
        instructions: Task instructions.
        category: One of the on-chain categories (see get_catalog_rules).
        bounty_micros: Bounty in micro-USDC (6 decimals).
        deadline_at_iso: Deadline as ISO 8601 (e.g. 2026-12-31T23:59:59+00:00).
        requester_erc8004_id: Optional ERC-8004 id for requester.
        evidence_schema_json: JSON object string for evidence_schema (default "{}").
        executor_requirements_json: JSON object string for executor_requirements (default "{}").

    Set env EXECUTION_MARKET_X_PAYMENT_SKIP=1 only against a **development** API (same as REST).
    """
    try:
        evidence_schema = json.loads(evidence_schema_json or "{}")
        executor_requirements = json.loads(executor_requirements_json or "{}")
    except json.JSONError as e:
        return f"Invalid JSON in evidence_schema_json or executor_requirements_json: {e}"
    if not isinstance(evidence_schema, dict) or not isinstance(executor_requirements, dict):
        return "evidence_schema and executor_requirements must be JSON objects"

    payload: dict[str, Any] = {
        "requester_wallet": requester_wallet.strip(),
        "requester_erc8004_id": requester_erc8004_id,
        "title": title,
        "instructions": instructions,
        "category": category.strip().lower(),
        "bounty_micros": bounty_micros,
        "deadline_at": deadline_at_iso.strip(),
        "evidence_schema": evidence_schema,
        "executor_requirements": executor_requirements,
    }
    url = f"{_base()}/api/v1/tasks"
    headers = {"Content-Type": "application/json", **_skip_payment_headers()}
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(url, json=payload, headers=headers)
    body = r.text[:4000]
    if not r.is_success:
        return f"HTTP {r.status_code}: {body}"
    try:
        return json.dumps(r.json(), indent=2)
    except Exception:
        return body


def main() -> None:
    logging.basicConfig(level=logging.INFO, stream=sys.stderr, format="%(message)s")
    logger.info("execution-market-mcp serving (stdio); API base %s", _base())
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
