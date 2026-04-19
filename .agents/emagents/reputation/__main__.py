"""
Poll completed tasks missing a completion reputation row (repair / backfill).

Run: `python -m emagents.reputation`
"""

from __future__ import annotations

import logging
import sys
import time

from emagents.bootstrap import ensure_backend_import_path

ensure_backend_import_path()

from em_api.config import settings  # noqa: E402
from em_api.services.verification_ops import record_completion_reputation  # noqa: E402
from supabase import create_client  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("emagents.reputation")


def main() -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing")
        sys.exit(1)
    supa = create_client(settings.supabase_url, settings.supabase_service_role_key)
    interval = settings.reputation_poll_interval_sec
    logger.info("Reputation repair poller started (interval=%ss)", interval)
    while True:
        try:
            done = (
                supa.table("tasks")
                .select("task_id,executor_id,bounty_micros,category")
                .eq("status", "completed")
                .limit(50)
                .execute()
            )
            for row in done.data or []:
                tid = row["task_id"]
                ev = (
                    supa.table("reputation_events")
                    .select("id")
                    .eq("source_task_id", tid)
                    .eq("event_type", "completion")
                    .limit(1)
                    .execute()
                )
                if ev.data:
                    continue
                tr = supa.table("tasks").select("*").eq("task_id", tid).single().execute()
                if tr.data:
                    tx = (tr.data.get("on_chain_tx_release") or "") or ""
                    record_completion_reputation(supa, tid, tr.data, tx)
                    logger.info("backfilled reputation task_id=%s", tid)
        except Exception:
            logger.exception("reputation loop error")
        time.sleep(interval)


if __name__ == "__main__":
    main()
