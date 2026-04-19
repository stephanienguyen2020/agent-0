from functools import lru_cache

from em_api.config import settings
from em_api.services.chain import ChainService


@lru_cache
def get_chain() -> ChainService:
    return ChainService()


def get_supabase():
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    from supabase import create_client

    return create_client(settings.supabase_url, settings.supabase_service_role_key)
