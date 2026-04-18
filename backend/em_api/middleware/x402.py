"""HTTP 402 payment requirements (x402) for task creation."""

from __future__ import annotations

import json
from typing import Callable

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from web3 import Web3

from em_api.config import settings
from em_api.constants import ESCROW_FEE_BPS


def _checksum_or_empty(addr: str) -> str:
    return Web3.to_checksum_address(addr) if addr else ""


def payment_required_body(*, resource: str, max_amount_micros: int) -> dict:
    usdc = settings.mock_usdc_address or ""
    escrow = settings.em_escrow_address or ""
    return {
        "x402Version": 1,
        "error": "X-PAYMENT header required",
        "accepts": [
            {
                "scheme": "exact",
                "network": "opbnb-testnet",
                "maxAmountRequired": str(max_amount_micros),
                "resource": resource,
                "description": "Agent Zero task escrow — EIP-3009 MockUSDC to EMEscrow, then publishTaskX402",
                "mimeType": "application/json",
                "payTo": _checksum_or_empty(escrow),
                "maxTimeoutSeconds": 300,
                "asset": _checksum_or_empty(usdc),
                "extra": {
                    "name": "MockUSDC",
                    "version": "1",
                    "eip3009": True,
                },
            }
        ],
    }


def _is_create_task_collection_post(path: str) -> bool:
    p = path.rstrip("/")
    return p.endswith("/api/v1/tasks")


class X402Middleware(BaseHTTPMiddleware):
    """Require X-PAYMENT for POST /api/v1/tasks when enforcement is on."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not settings.x402_enforce:
            return await call_next(request)
        if request.method != "POST" or not _is_create_task_collection_post(request.url.path):
            return await call_next(request)
        if request.headers.get("X-PAYMENT"):
            return await call_next(request)
        if settings.environment == "development" and request.headers.get("X-PAYMENT-SKIP") == "1":
            return await call_next(request)

        body_bytes = await request.body()

        async def receive():
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        request = Request(request.scope, receive)

        try:
            data = json.loads(body_bytes or b"{}")
            bounty = int(data.get("bounty_micros", 0))
        except (ValueError, TypeError, json.JSONDecodeError):
            bounty = 0
        fee = bounty * ESCROW_FEE_BPS // 10_000
        total = bounty + fee
        resource = f"{settings.backend_public_url.rstrip('/')}/api/v1/tasks"
        payload = payment_required_body(resource=resource, max_amount_micros=total)
        return Response(
            content=json.dumps(payload),
            status_code=402,
            media_type="application/json",
        )
