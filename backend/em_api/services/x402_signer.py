"""EIP-3009 (MockUSDC) typed-data helpers and signing for x402."""

from __future__ import annotations

import secrets
import time
from typing import Any

from eth_account import Account
from eth_account.messages import encode_typed_data
from web3 import Web3

TOKEN_NAME = "MockUSDC"
TOKEN_VERSION = "1"
NETWORK = "opbnb-testnet"


def build_transfer_with_authorization_full_message(
    *,
    verifying_contract: str,
    chain_id: int,
    from_addr: str,
    to_addr: str,
    value: int,
    valid_after: int,
    valid_before: int,
    nonce_hex: str,
) -> dict[str, Any]:
    """Full EIP-712 structure for eth_account.encode_typed_data (matches MockUSDC + OZ EIP712)."""
    vc = Web3.to_checksum_address(verifying_contract)
    from_cs = Web3.to_checksum_address(from_addr)
    to_cs = Web3.to_checksum_address(to_addr)
    nh = nonce_hex if nonce_hex.startswith("0x") else "0x" + nonce_hex
    return {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ],
        },
        "primaryType": "TransferWithAuthorization",
        "domain": {
            "name": TOKEN_NAME,
            "version": TOKEN_VERSION,
            "chainId": chain_id,
            "verifyingContract": vc,
        },
        "message": {
            "from": from_cs,
            "to": to_cs,
            "value": value,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nh,
        },
    }


def random_nonce_hex_32() -> str:
    return "0x" + secrets.token_hex(32)


def sign_transfer_with_authorization(
    *,
    private_key: str,
    verifying_contract: str,
    chain_id: int,
    from_addr: str,
    to_addr: str,
    value: int,
    valid_after: int | None = None,
    valid_before: int | None = None,
    nonce_hex: str | None = None,
) -> dict[str, Any]:
    """
    Sign MockUSDC.transferWithAuthorization EIP-712 and return x402 Authorization JSON
    (suitable for X-PAYMENT after base64 encoding).
    """
    va = 0 if valid_after is None else valid_after
    vb = int(time.time()) + 600 if valid_before is None else valid_before
    nonce = nonce_hex if nonce_hex is not None else random_nonce_hex_32()

    full = build_transfer_with_authorization_full_message(
        verifying_contract=verifying_contract,
        chain_id=chain_id,
        from_addr=from_addr,
        to_addr=to_addr,
        value=value,
        valid_after=va,
        valid_before=vb,
        nonce_hex=nonce,
    )
    msg = encode_typed_data(full_message=full)
    acct = Account.from_key(private_key)
    if acct.address.lower() != Web3.to_checksum_address(from_addr).lower():
        raise ValueError("private_key does not match from_addr")
    signed = acct.sign_message(msg)
    sig = signed.signature.hex()
    if not sig.startswith("0x"):
        sig = "0x" + sig
    return {
        "x402Version": 1,
        "scheme": "exact",
        "network": NETWORK,
        "payload": {
            "from": Web3.to_checksum_address(from_addr),
            "to": Web3.to_checksum_address(to_addr),
            "value": str(value),
            "validAfter": str(va),
            "validBefore": str(vb),
            "nonce": nonce if nonce.startswith("0x") else "0x" + nonce,
            "signature": sig,
        },
    }
