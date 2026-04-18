"""
Robot executor: IRC listener for physical-presence tasks; accepts only within geo radius.

Uses ROBOT_LAT / ROBOT_LNG / ROBOT_MAX_DISTANCE_M vs task location_*.

Run::

    PYTHONPATH=backend python -m emagents.robot_executor
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
from emagents.geo_utils import distance_m

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.robot_executor")

TASK_RE = re.compile(r"\btk_[a-zA-Z0-9]+\b")


class RobotBot(PydleClient):
    def __init__(self, nickname: str, listen_channel: str, base_api: str) -> None:
        super().__init__(nickname)
        self._listen = listen_channel
        self._base = base_api.rstrip("/")
        self._executor = settings.demo_executor_wallet.strip()
        self._executor_erc = settings.demo_executor_erc8004_id
        self._client: httpx.AsyncClient | None = None

    async def on_connect(self) -> None:
        await self.join(self._listen)
        logger.info("Robot listening on %s", self._listen)

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
            gr = await self._client.get(f"{self._base}/api/v1/tasks/{task_id}", headers=headers)
            if gr.status_code != 200:
                logger.warning("get task %s failed %s", task_id, gr.status_code)
                return
            task = gr.json()
            if task.get("category") != "physical_presence":
                logger.debug("skip non-physical task_id=%s", task_id)
                return
            lat, lng = task.get("location_lat"), task.get("location_lng")
            rad = task.get("location_radius_m")
            if lat is None or lng is None:
                logger.debug("skip task without location task_id=%s", task_id)
                return
            d = distance_m(float(settings.robot_lat), float(settings.robot_lng), float(lat), float(lng))
            max_d = float(rad) if rad is not None else settings.robot_max_distance_m
            if d > max_d:
                logger.info(
                    "skip task_id=%s distance_m=%.1f max=%.1f",
                    task_id,
                    d,
                    max_d,
                )
                return
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
            evidence = {"photo_urls": ["https://example.com/robot-sensor.jpg"], "gps_lat": lat, "gps_lng": lng}
            sr = await self._client.post(
                f"{self._base}/api/v1/tasks/{task_id}/submit",
                data={"evidence": json.dumps(evidence)},
                headers=headers,
            )
            if sr.status_code >= 400:
                logger.warning("submit %s failed %s %s", task_id, sr.status_code, sr.text)
                return
            logger.info("robot accepted+submitted task_id=%s distance_m=%.1f", task_id, d)
        except Exception:
            logger.exception("robot handle task_id=%s", task_id)


async def async_main() -> None:
    exec_w = settings.demo_executor_wallet.strip()
    if not exec_w:
        logger.error("Set DEMO_EXECUTOR_WALLET")
        sys.exit(1)

    chan = "#em-tasks-a2a"
    base = settings.backend_public_url
    nick = settings.irc_nickname + "-robot"

    bot = RobotBot(nick, chan, base)
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
