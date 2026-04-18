"""Wallet-signed onboarding messages for ai_agent / robot executors (non–World-ID lane)."""

from __future__ import annotations

from eth_account import Account
from eth_account.messages import encode_defunct


def agent_executor_message_text(
    *,
    wallet_checksum: str,
    erc8004_agent_id: int,
    nonce: str,
    domain: str,
    chain_id: int,
) -> str:
    """Human-readable message signed with personal_sign (encode_defunct)."""
    return (
        "Execution Market agent executor onboarding\n\n"
        f"Wallet: {wallet_checksum}\n"
        f"ERC-8004 agent ID: {erc8004_agent_id}\n"
        f"Nonce: {nonce}\n"
        f"Domain: {domain}\n"
        f"Chain ID: {chain_id}\n"
    )


def recover_signer_address(message_text: str, signature_hex: str) -> str:
    encoded = encode_defunct(text=message_text)
    return Account.recover_message(encoded, signature=signature_hex)


def verify_wallet_signature(wallet_checksum: str, message_text: str, signature_hex: str) -> bool:
    try:
        recovered = recover_signer_address(message_text, signature_hex)
    except Exception:
        return False
    return recovered.lower() == wallet_checksum.lower()
