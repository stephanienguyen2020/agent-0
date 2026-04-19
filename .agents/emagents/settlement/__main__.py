"""Run: `python -m emagents.settlement` from repo root (with backend on PYTHONPATH or venv)."""

from __future__ import annotations

import logging
import sys
import time

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402
from em_api.services.chain import ChainService  # noqa: E402
from em_api.services.settlement_ops import settle_one_verified_task  # noqa: E402
from supabase import create_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.settlement")


def main() -> None:
    if settings.verify_completes_chain:
        logger.warning(
            "SETTLEMENT_WORKER: VERIFY_COMPLETES_CHAIN=true — API verify already releases; poller idle."
        )
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
        sys.exit(1)
    supa = create_client(settings.supabase_url, settings.supabase_service_role_key)
    chain = ChainService()
    interval = settings.settlement_poll_interval_sec
    lim = settings.settlement_batch_limit
    logger.info("Settlement poller started (interval=%ss, batch=%s)", interval, lim)
    while True:
        try:
            r = (
                supa.table("tasks")
                .select("task_id")
                .eq("status", "verified")
                .limit(lim)
                .execute()
            )
            rows = r.data or []
            for row in rows:
                tid = row["task_id"]
                out = settle_one_verified_task(supa=supa, chain=chain, task_id=tid)
                if out.get("ok"):
                    logger.info("settled task_id=%s tx=%s", tid, out.get("on_chain_tx_release"))
                elif not out.get("skipped"):
                    logger.warning("settle failed task_id=%s err=%s", tid, out.get("error"))
        except Exception:
            logger.exception("settlement loop error")
        time.sleep(interval)


if __name__ == "__main__":
    main()
