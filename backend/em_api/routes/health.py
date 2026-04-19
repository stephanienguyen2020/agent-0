from fastapi import APIRouter, Depends

from em_api.deps import get_chain, get_supabase

router = APIRouter(tags=["health"])


@router.get("/health")
def health(chain=Depends(get_chain)) -> dict:
    supa = get_supabase()
    supa_status = "skipped"
    if supa is not None:
        try:
            supa.table("tasks").select("task_id").limit(1).execute()
            supa_status = "ok"
        except Exception:
            supa_status = "error"
    rpc = "ok" if chain.healthy() else "error"
    overall = "ok" if supa_status in ("ok", "skipped") and rpc == "ok" else "degraded"
    return {"status": overall, "supabase": supa_status, "rpc_opbnb": rpc}


@router.get("/version")
def version() -> dict:
    return {"service": "em-backend", "version": "0.1.0"}
