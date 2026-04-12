"""opBNB / EMEscrow interactions via web3.py."""

from __future__ import annotations

from typing import Any

from eth_account import Account
from web3 import Web3
from web3.contract import Contract

from em_api.config import settings

# Minimal ABI for MVP lifecycle (matches contracts/src/EMEscrow.sol)
EM_ESCROW_ABI: list[dict[str, Any]] = [
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "uint256", "name": "agentErc8004Id", "type": "uint256"},
            {"internalType": "uint8", "name": "category", "type": "uint8"},
            {"internalType": "uint256", "name": "bounty", "type": "uint256"},
            {"internalType": "uint64", "name": "deadline", "type": "uint64"},
        ],
        "name": "publishTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "uint256", "name": "agentErc8004Id", "type": "uint256"},
            {"internalType": "uint8", "name": "category", "type": "uint8"},
            {"internalType": "uint256", "name": "bounty", "type": "uint256"},
            {"internalType": "uint64", "name": "deadline", "type": "uint64"},
        ],
        "name": "publishTaskX402",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "address", "name": "executor", "type": "address"},
            {"internalType": "uint256", "name": "executorErc8004Id", "type": "uint256"},
        ],
        "name": "acceptTask",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "string", "name": "evidenceURI", "type": "string"},
        ],
        "name": "submitEvidence",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "taskId", "type": "bytes32"}],
        "name": "markVerified",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "bytes32", "name": "taskId", "type": "bytes32"}],
        "name": "release",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(settings.opbnb_rpc_url))


def _escrow(w3: Web3) -> Contract | None:
    if not settings.em_escrow_address:
        return None
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.em_escrow_address),
        abi=EM_ESCROW_ABI,
    )


def task_id_to_bytes32(task_id: str) -> bytes:
    return Web3.keccak(text=task_id)


def category_to_uint(category: str) -> int:
    m = {
        "physical_presence": 0,
        "knowledge_access": 1,
        "human_authority": 2,
        "simple_action": 3,
        "digital_physical": 4,
    }
    if category not in m:
        raise ValueError(f"unknown category {category}")
    return m[category]


def _fill_gas(w3: Web3, tx: dict) -> dict:
    if "gasPrice" not in tx and "maxFeePerGas" not in tx:
        tx["gasPrice"] = w3.eth.gas_price
    tx.setdefault("gas", w3.eth.estimate_gas(tx))
    return tx


class ChainService:
    def __init__(self) -> None:
        self._w3 = _w3()
        self._escrow = _escrow(self._w3)
        self._account = (
            Account.from_key(settings.em_agent_private_key) if settings.em_agent_private_key else None
        )

    def healthy(self) -> bool:
        try:
            return self._w3.is_connected() and self._w3.eth.block_number >= 0
        except Exception:
            return False

    def publish_task(
        self,
        task_id: str,
        agent_wallet: str,
        agent_erc8004_id: int,
        category: str,
        bounty_micros: int,
        deadline_unix: int,
    ) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        agent = Web3.to_checksum_address(agent_wallet)
        fn = self._escrow.functions.publishTask(
            tid,
            agent,
            agent_erc8004_id,
            category_to_uint(category),
            int(bounty_micros),
            int(deadline_unix),
        )
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)

    def publish_task_x402(
        self,
        task_id: str,
        agent_wallet: str,
        agent_erc8004_id: int,
        category: str,
        bounty_micros: int,
        deadline_unix: int,
    ) -> str | None:
        """Publish after USDC was moved to escrow (e.g. EIP-3009 x402 settle)."""
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        agent = Web3.to_checksum_address(agent_wallet)
        fn = self._escrow.functions.publishTaskX402(
            tid,
            agent,
            agent_erc8004_id,
            category_to_uint(category),
            int(bounty_micros),
            int(deadline_unix),
        )
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)

    def accept_task(self, task_id: str, executor_wallet: str, executor_erc8004_id: int) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        ex = Web3.to_checksum_address(executor_wallet)
        fn = self._escrow.functions.acceptTask(tid, ex, executor_erc8004_id)
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)

    def submit_evidence(self, task_id: str, sha256_hex: str, evidence_uri: str) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        hx = sha256_hex.removeprefix("0x").lower()
        if len(hx) != 64:
            raise ValueError("sha256 must be 32 bytes hex")
        b32 = bytes.fromhex(hx)
        fn = self._escrow.functions.submitEvidence(tid, b32, evidence_uri)
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)

    def mark_verified(self, task_id: str) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        fn = self._escrow.functions.markVerified(tid)
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)

    def release(self, task_id: str) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        fn = self._escrow.functions.release(tid)
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": self._w3.eth.get_transaction_count(self._account.address),
                "chainId": settings.chain_id,
            }
        )
        tx = _fill_gas(self._w3, tx)
        signed = self._account.sign_transaction(tx)
        h = self._w3.eth.send_raw_transaction(signed.raw_transaction)
        return self._w3.to_hex(h)
