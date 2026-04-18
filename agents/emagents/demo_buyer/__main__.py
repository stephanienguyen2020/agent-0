"""Cron-friendly demo buyer: POST a knowledge_access task to Execution Market API.

Uses `X-PAYMENT-SKIP` in development (same as scripted flows). Requires DEMO_BUYER_WALLET."""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime, timedelta, timezone

import httpx

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.demo_buyer")


async def main() -> None:
    base = settings.backend_public_url.rstrip("/")
    wallet = settings.demo_buyer_wallet.strip()
    if not wallet:
        logger.error("Set DEMO_BUYER_WALLET (matches requester_wallet)")
        sys.exit(1)

    erc = settings.demo_buyer_requester_erc8004_id
    deadline = datetime.now(timezone.utc) + timedelta(days=2)

    payload = {
        "requester_wallet": wallet,
        "requester_erc8004_id": erc,
        "title": "A2A demo research question",
        "instructions": "Summarize Solidity event indexing best practices in <= 200 words.",
        "category": "knowledge_access",
        "bounty_micros": 1_000_000,
        "deadline_at": deadline.isoformat(),
        "evidence_schema": {"document_url": "string"},
        "executor_requirements": {},
    }

    headers: dict[str, str] = {}
    if settings.environment == "development":
        headers["X-PAYMENT-SKIP"] = "1"

    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(f"{base}/api/v1/tasks", json=payload, headers=headers)
        if r.status_code >= 400:
            logger.error("create_task failed %s %s", r.status_code, r.text)
            sys.exit(1)
        body = r.json()
        logger.info("published task_id=%s publish_tx=%s", body.get("task_id"), body.get("on_chain_tx_publish"))


if __name__ == "__main__":
    asyncio.run(main())
