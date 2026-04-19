"""opBNB / EMEscrow interactions via web3.py."""

from __future__ import annotations

import logging
from typing import Any

from eth_account import Account
from web3 import Web3
from web3.contract import Contract
from web3.exceptions import ContractCustomError, ContractLogicError

from em_api.config import settings

logger = logging.getLogger(__name__)

# EMEscrow.TaskStatus enum uint8 (contracts/src/EMEscrow.sol)
ESCROW_TASK_STATUS_NONE = 0
ESCROW_TASK_STATUS_PUBLISHED = 1
ESCROW_TASK_STATUS_ACCEPTED = 2


class PreflightRejected(Exception):
    """publishTaskX402 would revert for a reason we detected without sending a tx."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class AcceptTaskRejected(Exception):
    """acceptTask eth_call / gas estimation would revert (e.g. InvalidStatus)."""

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


ERC20_MIN_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"internalType": "address", "name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]

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
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "string", "name": "reason", "type": "string"},
        ],
        "name": "dispute",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "bool", "name": "executorWins", "type": "bool"},
        ],
        "name": "resolveDispute",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "feeBps",
        "outputs": [{"internalType": "uint16", "name": "", "type": "uint16"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"internalType": "bytes32", "name": "role", "type": "bytes32"},
            {"internalType": "address", "name": "account", "type": "address"},
        ],
        "name": "hasRole",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "paused",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "totalUSDCCommitted",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "usdc",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "EM_AGENT_ROLE",
        "outputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# Public getter `tasks(bytes32)` (matches contracts/src/EMEscrow.sol Task struct).
EM_ESCROW_TASKS_VIEW_ABI: list[dict[str, Any]] = [
    {
        "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
        "name": "tasks",
        "outputs": [
            {"internalType": "bytes32", "name": "taskId", "type": "bytes32"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "uint256", "name": "agentErc8004Id", "type": "uint256"},
            {"internalType": "address", "name": "executor", "type": "address"},
            {"internalType": "uint256", "name": "executorErc8004Id", "type": "uint256"},
            {"internalType": "uint8", "name": "category", "type": "uint8"},
            {"internalType": "uint256", "name": "bounty", "type": "uint256"},
            {"internalType": "uint256", "name": "platformFee", "type": "uint256"},
            {"internalType": "uint64", "name": "deadline", "type": "uint64"},
            {"internalType": "uint8", "name": "status", "type": "uint8"},
            {"internalType": "bytes32", "name": "evidenceHash", "type": "bytes32"},
            {"internalType": "string", "name": "evidenceURI", "type": "string"},
        ],
        "stateMutability": "view",
        "type": "function",
    },
]

EM_ESCROW_EVENT_ABI: list[dict[str, Any]] = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "bytes32", "name": "taskId", "type": "bytes32"},
        ],
        "name": "TaskVerified",
        "type": "event",
    },
]

EM_ESCROW_ABI_FULL: list[dict[str, Any]] = EM_ESCROW_ABI + EM_ESCROW_TASKS_VIEW_ABI + EM_ESCROW_EVENT_ABI


def _w3() -> Web3:
    return Web3(Web3.HTTPProvider(settings.opbnb_rpc_url))


def _escrow(w3: Web3) -> Contract | None:
    if not settings.em_escrow_address:
        return None
    return w3.eth.contract(
        address=Web3.to_checksum_address(settings.em_escrow_address),
        abi=EM_ESCROW_ABI_FULL,
    )


def task_id_to_bytes32(task_id: str) -> bytes:
    return Web3.keccak(text=task_id)


CATEGORY_TO_UINT: dict[str, int] = {
    "physical_presence": 0,
    "knowledge_access": 1,
    "human_authority": 2,
    "simple_action": 3,
    "digital_physical": 4,
    # Frontend-only label until escrow adds enum variant — same uint as DigitalPhysical on-chain.
    "agent_to_agent": 4,
}


def category_to_uint(category: str) -> int:
    if category not in CATEGORY_TO_UINT:
        raise ValueError(f"unknown category {category}")
    return CATEGORY_TO_UINT[category]


def _fill_gas(w3: Web3, tx: dict) -> dict:
    if "gasPrice" not in tx and "maxFeePerGas" not in tx:
        tx["gasPrice"] = w3.eth.gas_price
    tx.setdefault("gas", w3.eth.estimate_gas(tx))
    return tx


# cast sig "publishTaskX402(bytes32,address,uint256,uint8,uint256,uint64)" -> 0x421bbe07
PUBLISH_TASK_X402_SELECTOR_HEX = "421bbe07"


def _escrow_bytecode_publish_x402_hint(w3: Web3, escrow_cs: str) -> tuple[bool, int]:
    """Whether dispatch table includes publishTaskX402; proxy bytecode is short (impl code lives elsewhere)."""
    raw = w3.eth.get_code(Web3.to_checksum_address(escrow_cs))
    hx = raw.hex()[2:].lower() if raw.hex().startswith("0x") else raw.hex().lower()
    return (PUBLISH_TASK_X402_SELECTOR_HEX in hx, len(raw))


def _publish_task_x402_call_failed_detail(
    exc: ContractLogicError,
    snap: dict[str, Any],
    *,
    selector_in_code: bool,
    code_len: int,
) -> str:
    """Actionable detail when eth_call reverts without RPC revert data (common on public nodes)."""
    rpc_data = getattr(exc, "data", None)
    lead = (
        "publishTaskX402 on-chain simulation reverted. "
        f"RPC revert data: {rpc_data!r}. "
    )
    if code_len < 900:
        return (
            lead
            + "Escrow bytecode at EM_ESCROW_ADDRESS is very short — this may be a proxy. "
            "Confirm the implementation includes publishTaskX402 (this repo's EMEscrow.sol) "
            "and that EM_ESCROW_ADDRESS points to the correct proxy/implementation pair."
        )
    if not selector_in_code:
        return (
            lead
            + "Bytecode at EM_ESCROW_ADDRESS does not contain the publishTaskX402 selector "
            f"(0x{PUBLISH_TASK_X402_SELECTOR_HEX}). "
            "Redeploy EMEscrow from contracts/src/EMEscrow.sol in this repo and set EM_ESCROW_ADDRESS."
        )
    tail = (
        "The function appears in bytecode; typical on-chain causes are InsufficientFreeUSDC, "
        "DeadlinePassed, or TaskAlreadyExists — try an archive/full RPC for decoded revert reasons."
    )
    if snap.get("ok"):
        tail += (
            f" Preflight: committed={snap.get('total_usdc_committed')} µUSDC, "
            f"escrow_balance={snap.get('usdc_balance_escrow')} µUSDC, "
            f"total_need={snap.get('total_need_micros')} µUSDC."
        )
    return lead + tail


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

    def escrow_task_status_uint(self, task_id: str) -> int | None:
        """Return `EMEscrow.TaskStatus` uint8 (`tasks(taskId).status`), or None if unreadable."""
        if not self._escrow:
            return None
        tid = task_id_to_bytes32(task_id)
        try:
            row = self._escrow.functions.tasks(tid).call()
            return int(row[9])
        except Exception as e:
            logger.warning("escrow_task_status_uint failed: %s", e)
            return None

    def escrow_task_snapshot(self, task_id: str) -> dict[str, Any] | None:
        """Public `tasks(taskId)` row for reconciliation (executor, status, …)."""
        if not self._escrow:
            return None
        tid = task_id_to_bytes32(task_id)
        try:
            row = self._escrow.functions.tasks(tid).call()
            return {
                "executor": row[3],
                "executorErc8004Id": int(row[4]),
                "status": int(row[9]),
            }
        except Exception as e:
            logger.warning("escrow_task_snapshot failed: %s", e)
            return None

    def latest_task_verified_tx_hash(self, task_id: str, *, max_blocks_back: int = 80_000) -> str | None:
        """Find the latest `TaskVerified(taskId)` tx hash from escrow logs (for DB backfill)."""
        if not settings.em_escrow_address:
            return None
        esc = Web3.to_checksum_address(settings.em_escrow_address)
        tid = task_id_to_bytes32(task_id)
        sig_h = Web3.to_hex(Web3.keccak(text="TaskVerified(bytes32)"))
        tid_h = Web3.to_hex(tid)
        try:
            latest = int(self._w3.eth.block_number)
            from_block = max(0, latest - max_blocks_back)
            logs = self._w3.eth.get_logs(
                {
                    "fromBlock": from_block,
                    "toBlock": latest,
                    "address": esc,
                    "topics": [sig_h, tid_h],
                }
            )
        except Exception as e:
            logger.warning("latest_task_verified_tx_hash get_logs failed: %s", e)
            return None
        if not logs:
            return None
        return self._w3.to_hex(logs[-1]["transactionHash"])

    def wait_for_transaction(self, tx_hash_hex: str | None, *, timeout: int = 180) -> Any:
        """Block until the transaction is mined and success (status 1). Required before a follow-up tx that depends on it."""
        if not tx_hash_hex or not self._w3:
            return None
        h = tx_hash_hex if str(tx_hash_hex).startswith("0x") else f"0x{tx_hash_hex}"
        receipt = self._w3.eth.wait_for_transaction_receipt(h, timeout=timeout)
        status = receipt.get("status")
        if status != 1:
            raise RuntimeError(f"transaction reverted on-chain (status={status}): {h}")
        return receipt

    def escrow_fee_bps(self) -> int | None:
        """Deployed escrow fee numerator (basis points); source of truth for EIP-3009 totals."""
        if not self._escrow:
            return None
        try:
            return int(self._escrow.functions.feeBps().call())
        except Exception:
            return None

    def _committed_micros_via_storage(self, escrow_cs: str) -> int | None:
        """When totalUSDCCommitted() eth_call fails (RPC quirks), read slot from forge layout (default slot 3)."""
        try:
            slot = int(settings.em_escrow_committed_storage_slot)
            raw = self._w3.eth.get_storage_at(Web3.to_checksum_address(escrow_cs), slot)
            return int.from_bytes(raw, "big")
        except Exception:
            return None

    def publish_task_x402_preflight(
        self,
        task_id: str,
        agent_wallet: str,
        agent_erc8004_id: int,
        category: str,
        bounty_micros: int,
        deadline_unix: int,
    ) -> dict[str, Any]:
        """On-chain facts for publishTaskX402 reverts (no secrets)."""
        out: dict[str, Any] = {"ok": False}
        if not self._escrow or not self._account:
            out["reason"] = "escrow_or_agent_key_missing"
            return out

        esc_addr = Web3.to_checksum_address(settings.em_escrow_address)

        try:
            block_ts = int(self._w3.eth.get_block("latest")["timestamp"])
            chain_net = int(self._w3.eth.chain_id)
        except Exception as e:
            out["reason"] = "rpc_error"
            out["preflight_msg"] = str(e)[:240]
            return out

        code = self._w3.eth.get_code(esc_addr)
        if len(code) == 0:
            out["reason"] = "em_escrow_not_a_contract"
            out["em_escrow_address"] = esc_addr
            return out

        ec = self._escrow

        def read_view(label: str, thunk):
            try:
                return thunk()
            except ContractLogicError as e:
                out["failed_view"] = label
                out["reason"] = "em_escrow_read_reverted"
                out["preflight_msg"] = str(e)[:240]
                raise

        try:
            fb = int(read_view("feeBps", lambda: ec.functions.feeBps().call()))
            fee_amt = int(bounty_micros) * fb // 10_000
            total_need = int(bounty_micros) + fee_amt
            committed = 0
            committed_read_ok = False
            try:
                committed = int(ec.functions.totalUSDCCommitted().call())
                committed_read_ok = True
            except Exception as ex_committed:
                # Broad catch: some RPCs raise outside ContractLogicError for eth_call quirks.
                out["totalUSDCCommitted_call_error"] = f"{type(ex_committed).__name__}: {str(ex_committed)[:160]}"
                cs = self._committed_micros_via_storage(esc_addr)
                if cs is not None:
                    committed = cs
                    committed_read_ok = True
                    out["totalUSDCCommitted_via_storage_slot"] = settings.em_escrow_committed_storage_slot
                else:
                    out["totalUSDCCommitted_read_failed"] = True
                    out["committed_unknown"] = True
            usdc_addr_val = read_view("usdc", lambda: ec.functions.usdc().call())
            tok = self._w3.eth.contract(address=Web3.to_checksum_address(usdc_addr_val), abi=ERC20_MIN_ABI)
            bal = int(
                read_view(
                    "balanceOf_escrow_mock_usdc",
                    lambda: tok.functions.balanceOf(esc_addr).call(),
                )
            )
            paused = bool(read_view("paused", lambda: ec.functions.paused().call()))
            signer = self._account.address
            try:
                role_hash = ec.functions.EM_AGENT_ROLE().call()
            except Exception:
                role_hash = Web3.keccak(text="EM_AGENT_ROLE")
            has_role = bool(read_view("hasRole", lambda: ec.functions.hasRole(role_hash, signer).call()))
            deadline_ok = int(deadline_unix) > block_ts
            liquidity_ok = committed_read_ok and (bal >= committed + total_need)
            out.update(
                {
                    "ok": True,
                    "chain_id_rpc": chain_net,
                    "chain_id_settings": settings.chain_id,
                    "block_timestamp": block_ts,
                    "deadline_unix": int(deadline_unix),
                    "deadline_ok": deadline_ok,
                    "fee_bps": fb,
                    "bounty_micros": int(bounty_micros),
                    "fee_micros_onchain_formula": fee_amt,
                    "total_need_micros": total_need,
                    "total_usdc_committed": committed,
                    "total_usdc_committed_read_ok": committed_read_ok,
                    "usdc_balance_escrow": bal,
                    "liquidity_ok": liquidity_ok,
                    "escrow_paused": paused,
                    "em_agent_signer": signer,
                    "has_em_agent_role": has_role,
                },
            )
        except ContractLogicError:
            pass
        except Exception as e:
            out["preflight_error"] = type(e).__name__
            out["preflight_msg"] = str(e)[:240]
        return out

    def publish_task_x402_human_hint(self, snap: dict[str, Any]) -> str | None:
        if not snap.get("ok"):
            if snap.get("reason") == "em_escrow_not_a_contract":
                return (
                    f"No contract bytecode at EM_ESCROW_ADDRESS ({snap.get('em_escrow_address')}). "
                    "Set EM_ESCROW_ADDRESS to your deployed EMEscrow on opBNB Testnet (same chain as OPBNB_RPC_URL / CHAIN_ID)."
                )
            if snap.get("reason") == "em_escrow_read_reverted":
                fv = snap.get("failed_view", "?")
                return (
                    f"Calling EMEscrow.{fv}() reverted — EM_ESCROW_ADDRESS may not be this repo's EMEscrow on this RPC, "
                    "or you're on the wrong chain. Verify the address on an opBNB explorer and align OPBNB_RPC_URL / CHAIN_ID / EM_ESCROW_ADDRESS."
                )
            if snap.get("reason") == "rpc_error":
                return f"RPC error reading latest block / chain id: {snap.get('preflight_msg', '')}"
            return snap.get("reason") or snap.get("preflight_msg")
        if snap.get("escrow_paused"):
            return "EMEscrow is paused — unpause or deploy a new escrow."
        if not snap.get("has_em_agent_role"):
            return (
                f"Signer {snap.get('em_agent_signer')} (EM_AGENT_PRIVATE_KEY) does not have EM_AGENT_ROLE on this EMEscrow. "
                "Grant the role to that address in the deploy script, or set EM_AGENT_PRIVATE_KEY to the funded EM agent wallet that was granted the role."
            )
        if not snap.get("deadline_ok"):
            return (
                f"Deadline {snap.get('deadline_unix')} is not after opBNB block time {snap.get('block_timestamp')} — "
                "choose a later deadline (or fix clock/timezone when sending deadline_at)."
            )
        if int(snap.get("chain_id_rpc") or 0) != int(snap.get("chain_id_settings") or 0):
            return (
                f"CHAIN_ID mismatch: RPC reports {snap.get('chain_id_rpc')} but settings.chain_id is "
                f"{snap.get('chain_id_settings')} — fix env so EIP-712 / txs target opBNB Testnet (5611)."
            )
        if snap.get("committed_unknown"):
            return (
                "Could not read totalUSDCCommitted (contract getter and eth_getStorageAt failed). "
                "If this escrow is behind a proxy, set EMESCROW_COMMITTED_STORAGE_SLOT to the layout slot "
                "for totalUSDCCommitted or use a full-node RPC."
            )
        if not snap.get("liquidity_ok"):
            c = snap.get("total_usdc_committed")
            bal = snap.get("usdc_balance_escrow")
            tn = snap.get("total_need_micros")
            return (
                f"InsufficientFreeUSDC: escrow MockUSDC balance ({bal} µUSDC) must cover "
                f"totalUSDCCommitted ({c}) + this task ({tn} µUSDC). "
                "Either EIP-3009 settle more USDC for bounty+fee, or release/refund tasks to reduce committed liquidity."
            )
        return None

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
        snap = self.publish_task_x402_preflight(
            task_id,
            agent_wallet,
            agent_erc8004_id,
            category,
            bounty_micros,
            deadline_unix,
        )
        hint = self.publish_task_x402_human_hint(snap)
        if hint:
            raise PreflightRejected(hint)

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
        try:
            fn.call({"from": self._account.address})
        except ContractLogicError as e:
            logger.warning("publishTaskX402 eth_call revert: %s", e)
            esc_cs = Web3.to_checksum_address(settings.em_escrow_address)
            cs = self._committed_micros_via_storage(esc_cs)
            bal = snap.get("usdc_balance_escrow") if snap.get("ok") else None
            tn = snap.get("total_need_micros") if snap.get("ok") else None
            if cs is not None and bal is not None and tn is not None and bal < cs + int(tn):
                raise PreflightRejected(
                    f"InsufficientFreeUSDC: escrow balance {bal} µUSDC < committed ({cs}) + this task ({tn}). "
                    "Increase the EIP-3009 authorization amount or reduce outstanding escrow commitments."
                ) from e
            sel_ok, code_len = _escrow_bytecode_publish_x402_hint(self._w3, esc_cs)
            raise PreflightRejected(
                _publish_task_x402_call_failed_detail(e, snap, selector_in_code=sel_ok, code_len=code_len)
            ) from e

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
        try:
            fn.call({"from": self._account.address})
        except (ContractLogicError, ContractCustomError) as e:
            logger.warning("acceptTask simulation reverted: %s", e)
            raise AcceptTaskRejected(
                "acceptTask would revert on-chain (wrong task status, deadline, executor, or EM_AGENT_ROLE)."
            ) from e
        try:
            tx = fn.build_transaction(
                {
                    "from": self._account.address,
                    "nonce": self._w3.eth.get_transaction_count(self._account.address),
                    "chainId": settings.chain_id,
                }
            )
        except (ContractLogicError, ContractCustomError) as e:
            logger.warning("acceptTask build_transaction reverted: %s", e)
            raise AcceptTaskRejected(
                "acceptTask gas estimation failed (task may already be accepted on-chain)."
            ) from e
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

    def dispute(self, task_id: str, reason: str) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        fn = self._escrow.functions.dispute(tid, reason)
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

    def resolve_dispute(self, task_id: str, executor_wins: bool) -> str | None:
        if not self._escrow or not self._account:
            return None
        tid = task_id_to_bytes32(task_id)
        fn = self._escrow.functions.resolveDispute(tid, executor_wins)
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
