"""EIP-3009 authorization helpers for agents (scaffold)."""

# Implement signing with eth_account.messages / EIP-712 per docs/11-x402-integration.md


def build_transfer_with_authorization_typed_data(
    *,
    chain_id: int,
    token_name: str,
    token_version: str,
    from_addr: str,
    to_addr: str,
    value: int,
    valid_after: int,
    valid_before: int,
    nonce: str,
) -> dict:
    """Return typed-data dict for MockUSDC.transferWithAuthorization."""
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
            "name": token_name,
            "version": token_version,
            "chainId": chain_id,
            "verifyingContract": "0x0000000000000000000000000000000000000000",
        },
        "message": {
            "from": from_addr,
            "to": to_addr,
            "value": str(value),
            "validAfter": str(valid_after),
            "validBefore": str(valid_before),
            "nonce": nonce,
        },
    }
