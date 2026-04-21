"""
Build DGrid x402 `x-payment` header for inference retries (https://docs.dgrid.ai/x402-api-reference).

Automatic signing is protocol-specific (network eip155:56, USD1 asset, scheme `upto`, etc.).
When unavailable, operators can paste a header into DGRID_X402_PAYMENT_HEADER after the first 402 response.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def build_x_payment_header(accepts: list[dict[str, Any]], private_key_hex: str) -> str | None:
    """
    Construct the value for the ``x-payment`` request header from a 402 ``accepts`` array.

    Returns ``None`` until a stable Python signer exists for DGrid's x402 variant; callers should
    use ``DGRID_X402_PAYMENT_HEADER`` from an external wallet flow when this returns ``None``.
    """
    _ = accepts
    _ = private_key_hex
    logger.info(
        "dgrid x402 auto-sign not implemented; set DGRID_X402_PAYMENT_HEADER or extend "
        "em_api.services.dgrid_x402_payment.build_x_payment_header per DGrid docs."
    )
    return None
