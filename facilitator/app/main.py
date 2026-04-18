"""
Minimal x402 facilitator: verify EIP-3009 (MockUSDC) and settle via transferWithAuthorization.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any

from eth_account import Account
from eth_account.messages import encode_typed_data
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field, field_validator
from web3 import Web3


def _load_repo_env() -> None:
    """Load monorepo root `.env` (and optional `facilitator/.env`) like the FastAPI app — raw `uvicorn` does not."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env")
    fac_env = root / "facilitator" / ".env"
    if fac_env.is_file():
        load_dotenv(fac_env, override=True)


_load_repo_env()

app = FastAPI(title="Agent Zero x402 Facilitator", version="0.1.0")

RPC_URL = os.environ.get("OPBNB_RPC") or os.environ.get("OPBNB_RPC_URL", "https://opbnb-testnet-rpc.bnbchain.org")
CHAIN_ID = int(os.environ.get("CHAIN_ID", "5611"))
MOCK_USDC = os.environ.get("MOCK_USDC_ADDRESS", "").strip()
EM_ESCROW = os.environ.get("EM_ESCROW_ADDRESS", "").strip()
TOKEN_NAME = os.environ.get("MOCK_USDC_EIP712_NAME", "MockUSDC")
TOKEN_VERSION = os.environ.get("MOCK_USDC_EIP712_VERSION", "1")
FACILITATOR_KEY = os.environ.get("FACILITATOR_PRIVATE_KEY", "").strip()

USDC_ABI = [
    {
        "name": "transferWithAuthorization",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "validAfter", "type": "uint256"},
            {"name": "validBefore", "type": "uint256"},
            {"name": "nonce", "type": "bytes32"},
            {"name": "v", "type": "uint8"},
            {"name": "r", "type": "bytes32"},
            {"name": "s", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "authorizationState",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "authorizer", "type": "address"},
            {"name": "nonce", "type": "bytes32"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(RPC_URL))


def _usdc_contract(w3: Web3):
    if not MOCK_USDC:
        raise HTTPException(503, "MOCK_USDC_ADDRESS not configured")
    return w3.eth.contract(address=Web3.to_checksum_address(MOCK_USDC), abi=USDC_ABI)


class Payload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    to: str
    value: str
    validAfter: str
    validBefore: str
    nonce: str
    signature: str

    @field_validator("from_", "to", mode="before")
    @classmethod
    def checksum_addr(cls, v: str) -> str:
        return Web3.to_checksum_address(v)


class Authorization(BaseModel):
    x402Version: int
    scheme: str
    network: str
    payload: Payload


def _typed_data_for_payload(p: Payload) -> dict[str, Any]:
    usdc_cs = Web3.to_checksum_address(MOCK_USDC)
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
            "chainId": CHAIN_ID,
            "verifyingContract": usdc_cs,
        },
        "message": {
            "from": p.from_,
            "to": p.to,
            "value": int(p.value),
            "validAfter": int(p.validAfter),
            "validBefore": int(p.validBefore),
            "nonce": p.nonce if p.nonce.startswith("0x") else "0x" + p.nonce,
        },
    }


def _nonce_to_bytes32(nonce: str) -> bytes:
    h = nonce.removeprefix("0x").lower()
    if len(h) != 64:
        raise HTTPException(400, "nonce must be 32 bytes hex")
    return bytes.fromhex(h)


def _split_sig(sig_hex: str) -> tuple[int, bytes, bytes]:
    raw = bytes.fromhex(sig_hex.removeprefix("0x"))
    if len(raw) != 65:
        raise HTTPException(400, "signature must be 65 bytes")
    r = raw[0:32]
    s = raw[32:64]
    v = raw[64]
    if v in (0, 1):
        v += 27
    if v not in (27, 28):
        raise HTTPException(400, "invalid signature v")
    return v, r, s


def _verify_auth(auth: Authorization) -> None:
    if auth.scheme != "exact":
        raise HTTPException(400, "unsupported scheme")
    if auth.network != "opbnb-testnet":
        raise HTTPException(400, "unsupported network")

    w3 = _w3()
    usdc = _usdc_contract(w3)
    p = auth.payload

    if EM_ESCROW and Web3.to_checksum_address(p.to) != Web3.to_checksum_address(EM_ESCROW):
        raise HTTPException(400, "payload.to must be EM escrow address")

    now = int(time.time())
    valid_after = int(p.validAfter)
    valid_before = int(p.validBefore)
    if now <= valid_after:
        raise HTTPException(400, "authorization not yet valid")
    if now >= valid_before:
        raise HTTPException(400, "authorization expired")

    td = _typed_data_for_payload(p)
    msg = encode_typed_data(full_message=td)
    sig_bytes = bytes.fromhex(p.signature.removeprefix("0x"))
    recovered = Account.recover_message(msg, signature=sig_bytes)
    if recovered.lower() != p.from_.lower():
        raise HTTPException(400, "signature mismatch")

    nonce_b = _nonce_to_bytes32(p.nonce)
    used = usdc.functions.authorizationState(p.from_, nonce_b).call()
    if used:
        raise HTTPException(400, "nonce already used")

    value = int(p.value)
    bal = usdc.functions.balanceOf(p.from_).call()
    if bal < value:
        raise HTTPException(402, f"insufficient balance: have {bal}, need {value}")


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "chainId": CHAIN_ID}


@app.post("/verify")
def verify(auth: Authorization) -> dict:
    _verify_auth(auth)
    return {"valid": True}


@app.post("/settle")
def settle(auth: Authorization) -> dict:
    if not FACILITATOR_KEY:
        raise HTTPException(503, "FACILITATOR_PRIVATE_KEY not configured")
    _verify_auth(auth)
    w3 = _w3()
    usdc = _usdc_contract(w3)
    signer = Account.from_key(FACILITATOR_KEY)
    p = auth.payload
    v, r, s = _split_sig(p.signature)
    nonce_b = _nonce_to_bytes32(p.nonce)

    fn = usdc.functions.transferWithAuthorization(
        p.from_,
        p.to,
        int(p.value),
        int(p.validAfter),
        int(p.validBefore),
        nonce_b,
        v,
        r,
        s,
    )
    tx = fn.build_transaction(
        {
            "from": signer.address,
            "nonce": w3.eth.get_transaction_count(signer.address),
            "chainId": CHAIN_ID,
            "gasPrice": w3.eth.gas_price,
        }
    )
    tx["gas"] = w3.eth.estimate_gas(tx)
    signed = signer.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    return {"valid": True, "txHash": w3.to_hex(h)}


@app.get("/")
def root() -> dict:
    return {"service": "em-x402-facilitator", "docs": "/docs"}
