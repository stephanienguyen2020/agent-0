from __future__ import annotations

from typing import Any

from emagents.common.config import settings


def create_supabase() -> Any:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)
