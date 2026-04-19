"""
IRC relay: announces `published` tasks missing `irc_synced_at`.

Run::

    PYTHONPATH=backend python -m emagents.irc_relay
"""

from __future__ import annotations

import asyncio
import logging
import sys
from datetime import datetime, timezone

from pydle import Client as PydleClient

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402
from supabase import create_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.irc_relay")


class RelayBot(PydleClient):
    def __init__(self, nickname: str, channels: list[str]) -> None:
        super().__init__(nickname)
        self._channels = channels

    async def on_connect(self) -> None:
        for ch in self._channels:
            await self.join(ch)
        logger.info("Joined channels: %s", self._channels)


async def poll_announce(bot: RelayBot, supa) -> None:
    while True:
        await asyncio.sleep(15)
        try:
            r = (
                supa.table("tasks")
                .select("task_id,title,status,irc_synced_at")
                .eq("status", "published")
                .is_("irc_synced_at", "null")
                .limit(10)
                .execute()
            )
            for row in r.data or []:
                tid = row["task_id"]
                title = row.get("title") or ""
                msg = f"[EM] New task {tid} — {title[:200]}"
                for ch in bot._channels:
                    await bot.message(ch, msg)
                now = datetime.now(timezone.utc).isoformat()
                supa.table("tasks").update({"irc_synced_at": now}).eq("task_id", tid).execute()
                logger.info("Announced task_id=%s", tid)
        except Exception:
            logger.exception("poll announce error")


async def async_main() -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
        sys.exit(1)
    supa = create_client(settings.supabase_url, settings.supabase_service_role_key)
    channels = [c.strip() for c in settings.irc_channels.split(",") if c.strip()]
    if not channels:
        channels = ["#em-announce"]

    bot = RelayBot(settings.irc_nickname, channels)
    asyncio.create_task(poll_announce(bot, supa))

    logger.info(
        "Connecting IRC %s:%s tls=%s nick=%s",
        settings.irc_server,
        settings.irc_port,
        settings.irc_tls,
        settings.irc_nickname,
    )
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
