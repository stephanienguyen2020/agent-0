"""Verifier worker: realtime (async) + poll `submitted` tasks → verify + markVerified.

Tasks move to ``submitted`` after the **requester** calls approve-evidence when
``REQUESTER_APPROVAL_BEFORE_VERIFY`` is enabled (otherwise submit sets ``submitted`` directly).

Run from repo root::

    PYTHONPATH=backend python -m emagents.verifier_worker

Idle when VERIFY_COMPLETES_CHAIN=true.

Realtime uses Supabase **async** client (`acreate_client`); sync client does not support channels.
"""

from __future__ import annotations

import asyncio
import logging
import sys

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402
from em_api.services.chain import ChainService  # noqa: E402
from em_api.services.verification_ops import process_verify_for_task  # noqa: E402
from supabase import acreate_client, create_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.verifier_worker")


async def _verify_task_sync(task_id: str, supa_sync, chain: ChainService) -> None:
    loop = asyncio.get_running_loop()

    def _run() -> dict:
        return process_verify_for_task(
            supa=supa_sync, chain=chain, settings=settings, task_id=task_id
        )

    out = await loop.run_in_executor(None, _run)
    if out.get("ok") and not out.get("skipped"):
        logger.info(
            "verified task_id=%s verify_tx=%s release_tx=%s",
            task_id,
            out.get("on_chain_tx_verify"),
            out.get("on_chain_tx_release"),
        )
    elif not out.get("ok"):
        logger.warning("verify failed task_id=%s err=%s", task_id, out.get("error"))


async def poll_loop(supa_sync, chain: ChainService) -> None:
    interval = settings.verifier_poll_interval_sec
    logger.info("Verifier poll loop interval=%ss", interval)
    while True:
        try:
            if settings.verify_completes_chain:
                await asyncio.sleep(interval)
                continue
            r = (
                supa_sync.table("tasks")
                .select("task_id")
                .eq("status", "submitted")
                .limit(15)
                .execute()
            )
            for row in r.data or []:
                await _verify_task_sync(row["task_id"], supa_sync, chain)
        except Exception:
            logger.exception("verifier poll error")
        await asyncio.sleep(interval)


async def realtime_loop(supa_sync, chain: ChainService) -> None:
    try:
        from realtime.types import RealtimePostgresChangesListenEvent  # noqa: PLC0415

        client = await acreate_client(settings.supabase_url, settings.supabase_service_role_key)

        async def _on(payload) -> None:
            try:
                if settings.verify_completes_chain:
                    return
                rec = getattr(payload, "record", None) or getattr(payload, "new", None)
                if isinstance(rec, dict):
                    data = rec
                elif rec is not None and hasattr(rec, "__dict__"):
                    data = dict(rec)
                else:
                    data = {}
                if data.get("status") != "submitted":
                    return
                tid = data.get("task_id")
                if not tid:
                    return
                await _verify_task_sync(tid, supa_sync, chain)
            except Exception:
                logger.exception("realtime handler error")

        channel = client.channel("em-verifier-tasks")
        channel.on_postgres_changes(
            RealtimePostgresChangesListenEvent.Update,
            _on,
            schema="public",
            table="tasks",
        )
        await channel.subscribe()
        logger.info("Verifier subscribed to tasks realtime (UPDATE)")
        await asyncio.Future()
    except Exception as e:
        logger.warning("Realtime disabled: %s — poll loop continues", e)


async def async_main() -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
        sys.exit(1)

    supa_sync = create_client(settings.supabase_url, settings.supabase_service_role_key)
    chain = ChainService()

    if settings.verify_completes_chain:
        logger.warning(
            "Verifier worker idle for chain verify: VERIFY_COMPLETES_CHAIN=true "
            "(POST /verify only); poll stays running as no-op."
        )

    poll = asyncio.create_task(poll_loop(supa_sync, chain))
    tasks = [poll]
    if settings.verifier_use_realtime:
        tasks.append(asyncio.create_task(realtime_loop(supa_sync, chain)))
    await asyncio.gather(*tasks)


def main() -> None:
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
