"""World ID signal digest — matches @worldcoin/idkit-core hashEncodedBytes (keccak >> 8, 32-byte hex)."""

from __future__ import annotations

from web3 import Web3


def world_id_signal_digest(signal: str) -> str:
    """Hash signal the same way IDKit does for plain wallet strings / hex inputs."""
    s = signal.strip()
    if s.startswith("0x") and len(s) == 42 and Web3.is_address(s):
        raw = bytes.fromhex(s[2:].lower())
    elif s.startswith("0x") and len(s) % 2 == 0 and len(s) > 2:
        try:
            raw = bytes.fromhex(s[2:].lower())
        except ValueError:
            raw = s.encode("utf-8")
    else:
        raw = s.encode("utf-8")
    h = Web3.keccak(raw)
    val = int.from_bytes(h, "big") >> 8
    return "0x" + format(val, "064x")
