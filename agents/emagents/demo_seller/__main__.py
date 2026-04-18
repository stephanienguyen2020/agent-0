"""
Demo seller: IRC client on `#em-tasks-a2a` accepts `tk_*` IDs and submits stub evidence.

Env: DEMO_EXECUTOR_WALLET, DEMO_EXECUTOR_ERC8004_ID, BACKEND_PUBLIC_URL.

Run::

    PYTHONPATH=backend python -m emagents.demo_seller
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys

import httpx
from pydle import Client as PydleClient

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.demo_seller")

TASK_RE = re.compile(r"\btk_[a-zA-Z0-9]+\b")


class SellerBot(PydleClient):
    def __init__(self, nickname: str, listen_channel: str, base_api: str) -> None:
        super().__init__(nickname)
        self._listen = listen_channel
        self._base = base_api.rstrip("/")
        self._executor = settings.demo_executor_wallet.strip()
        self._executor_erc = settings.demo_executor_erc8004_id
        self._client: httpx.AsyncClient | None = None

    async def on_connect(self) -> None:
        await self.join(self._listen)
        logger.info("Demo seller listening on %s", self._listen)

    async def on_message(self, target, by, message) -> None:
        if target.lower() != self._listen.lower():
            return
        if not self._executor:
            return
        for tid in TASK_RE.findall(message):
            asyncio.create_task(self._handle_task(tid))

    async def _handle_task(self, task_id: str) -> None:
        assert self._client is not None
        headers: dict[str, str] = {}
        if settings.environment == "development":
            headers["X-PAYMENT-SKIP"] = "1"
        try:
            ar = await self._client.post(
                f"{self._base}/api/v1/tasks/{task_id}/accept",
                json={
                    "executor_wallet": self._executor,
                    "executor_erc8004_id": self._executor_erc,
                },
                headers=headers,
            )
            if ar.status_code >= 400:
                logger.warning("accept %s failed %s %s", task_id, ar.status_code, ar.text)
                return
            evidence = {"document_url": "https://example.com/demo-seller-proof.md"}
            sr = await self._client.post(
                f"{self._base}/api/v1/tasks/{task_id}/submit",
                data={"evidence": json.dumps(evidence)},
                headers=headers,
            )
            if sr.status_code >= 400:
                logger.warning("submit %s failed %s %s", task_id, sr.status_code, sr.text)
                return
            logger.info("accepted+submitted task_id=%s", task_id)
        except Exception:
            logger.exception("handle task_id=%s", task_id)


async def async_main() -> None:
    exec_w = settings.demo_executor_wallet.strip()
    if not exec_w:
        logger.error("Set DEMO_EXECUTOR_WALLET")
        sys.exit(1)

    chan = "#em-tasks-a2a"
    base = settings.backend_public_url
    nick = settings.irc_nickname + "-seller"

    bot = SellerBot(nick, chan, base)
    bot._client = httpx.AsyncClient(timeout=180.0)

    await bot.connect(
        hostname=settings.irc_server,
        port=settings.irc_port,
        tls=settings.irc_tls,
        tls_verify=False,
        password=settings.irc_password or None,
    )
    await bot.handle_forever()


def main() -> None:
    try:
        asyncio.run(async_main())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
