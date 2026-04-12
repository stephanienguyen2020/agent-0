"""HTTP 402 payment requirements (x402 scaffold)."""

from __future__ import annotations

import json
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from em_api.config import settings


def payment_required_body(resource: str, amount_usd: str, pay_to: str) -> dict:
    return {
        "x402Version": 1,
        "error": "X-PAYMENT header required",
        "accepts": [
            {
                "scheme": "exact",
                "network": "opbnb-testnet",
                "asset": "USDC",
                "payTo": pay_to,
                "maxAmountRequired": amount_usd,
                "resource": resource,
                "description": "Execution Market task escrow (EIP-3009)",
            }
        ],
    }


class X402Middleware(BaseHTTPMiddleware):
    """Require X-PAYMENT for mutating /tasks when enforcement is on."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.x402_enforce:
            return await call_next(request)
        if request.method != "POST" or not request.url.path.rstrip("/").endswith("/tasks"):
            return await call_next(request)
        if request.headers.get("X-PAYMENT"):
            return await call_next(request)
        if settings.environment == "development" and request.headers.get("X-PAYMENT-SKIP") == "1":
            return await call_next(request)
        body = payment_required_body(
            resource=str(request.url.path),
            amount_usd="5.00",
            pay_to=settings.mock_usdc_address or "0x0000000000000000000000000000000000000000",
        )
        return Response(
            content=json.dumps(body),
            status_code=402,
            media_type="application/json",
        )
