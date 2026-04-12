"""HTTP client for the self-hosted x402 facilitator."""

from __future__ import annotations

import logging

import httpx

from em_api.config import settings

logger = logging.getLogger(__name__)


def settle_payment(authorization: dict) -> dict:
    """POST authorization JSON to facilitator /settle; returns JSON including txHash."""
    base = (settings.x402_facilitator_url or "").rstrip("/")
    if not base:
        raise RuntimeError("X402_FACILITATOR_URL is not configured")
    url = f"{base}/settle"
    with httpx.Client(timeout=120.0) as client:
        r = client.post(url, json=authorization)
        if r.status_code >= 400:
            logger.warning("facilitator settle failed: %s %s", r.status_code, r.text)
        r.raise_for_status()
        return r.json()
