"""
APEX-shaped HTTP shim until `bnbagent-sdk` is wired: `POST /job` with JSON body `{"params": {...}}`.

Each agent module can expose `handle(params) -> str` and mount here for local tests.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Callable

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route

logger = logging.getLogger(__name__)


def create_job_app(
    *, name: str, handler: Callable[[dict[str, Any]], str | dict[str, Any]]
) -> Starlette:
    async def job(request: Request) -> JSONResponse | PlainTextResponse:
        try:
            body = await request.json()
        except Exception as e:
            return JSONResponse({"error": f"invalid json: {e}"}, status_code=400)
        params = body.get("params") if isinstance(body, dict) else None
        if params is None:
            return JSONResponse({"error": "missing params"}, status_code=422)
        try:
            out = handler(params if isinstance(params, dict) else {})
            if isinstance(out, dict):
                return JSONResponse(out)
            return PlainTextResponse(str(out))
        except Exception as e:
            logger.exception("%s job failed", name)
            return JSONResponse({"error": str(e)}, status_code=500)

    return Starlette(
        debug=False,
        routes=[Route("/job", job, methods=["POST"]), Route("/apex/job", job, methods=["POST"])],
    )


def json_job_response(obj: dict[str, Any]) -> str:
    return json.dumps(obj)
