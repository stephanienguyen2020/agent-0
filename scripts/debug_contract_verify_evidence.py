#!/usr/bin/env python3
"""
Debug harness: probe Etherscan API v2 + run forge verify-contract; append NDJSON to session log.
Run from repo root:  python3 scripts/debug_contract_verify_evidence.py
Requires: ETHERSCAN_API_KEY, contracts built, forge on PATH.
Optional: MOCK_USDC, CHAIN_ID (default 5611), CONTRACT_PATH (default src/MockUSDC.sol:MockUSDC)
"""
# #region agent log
from __future__ import annotations

import json
import os
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

LOG_PATH = Path(__file__).resolve().parents[1] / ".cursor" / "debug-767189.log"
SESSION_ID = "767189"
REPO = Path(__file__).resolve().parents[1]
CONTRACTS = REPO / "contracts"


def _log(hypothesis_id: str, message: str, data: dict) -> None:
    payload = {
        "sessionId": SESSION_ID,
        "hypothesisId": hypothesis_id,
        "message": message,
        "data": data,
        "timestamp": int(time.time() * 1000),
    }
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(payload, default=str) + "\n")


# #endregion


def _redact_cmd_for_log(cmd: list[str]) -> list[str]:
    """Never log secrets: mask the value after --etherscan-api-key."""
    out: list[str] = []
    i = 0
    while i < len(cmd):
        if cmd[i] == "--etherscan-api-key" and i + 1 < len(cmd):
            out.extend(["--etherscan-api-key", "***"])
            i += 2
        else:
            out.append(cmd[i])
            i += 1
    return out


def _urlopen_get(url: str, timeout: int = 30) -> bytes:
    import ssl

    req = urllib.request.Request(url, method="GET")
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return resp.read()
    except urllib.error.URLError as e:
        err = str(e)
        if "CERTIFICATE_VERIFY_FAILED" not in err:
            raise
        try:
            import certifi

            ctx2 = ssl.create_default_context(cafile=certifi.where())
            with urllib.request.urlopen(req, timeout=timeout, context=ctx2) as resp:
                return resp.read()
        except ImportError:
            _log(
                "H1_ssl",
                "SSL verify failed; install certifi for Python probe",
                {"hint": "pip install certifi or run macOS Python Install Certificates.command"},
            )
            raise


def main() -> None:
    api_key = os.environ.get("ETHERSCAN_API_KEY", "").strip()
    if not api_key:
        _log("H_key", "ETHERSCAN_API_KEY missing", {"ok": False})
        print("Set ETHERSCAN_API_KEY (Etherscan v2 unified key).")
        return

    addr = os.environ.get("MOCK_USDC", "0xb5b64fbF816bFCA91094C53aC5606A960f91dB78").strip()
    chain_id = os.environ.get("CHAIN_ID", "5611").strip()
    contract = os.environ.get("CONTRACT_PATH", "src/MockUSDC.sol:MockUSDC").strip()

    # H1: V2 API accepts key + chainid for a read-only contract call
    q = urllib.parse.urlencode(
        {
            "chainid": chain_id,
            "module": "contract",
            "action": "getabi",
            "address": addr,
            "apikey": api_key,
        }
    )
    url = f"https://api.etherscan.io/v2/api?{q}"
    try:
        raw = _urlopen_get(url).decode("utf-8", errors="replace")
        try:
            j = json.loads(raw)
        except json.JSONDecodeError:
            j = {"_parse_error": True, "raw_prefix": raw[:500]}
        _log(
            "H1_api_v2_getabi",
            "Etherscan v2 getabi response",
            {
                "chainid": chain_id,
                "address": addr,
                "status": j.get("status"),
                "message": j.get("message"),
                "result_type": type(j.get("result")).__name__,
                "result_prefix": (str(j.get("result"))[:200] if j.get("result") is not None else None),
            },
        )
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:800]
        _log("H1_api_v2_getabi", "HTTPError on getabi", {"code": e.code, "body_prefix": body})
    except Exception as e:
        _log("H1_api_v2_getabi", "getabi exception", {"error": str(e)})

    # H2: forge version
    try:
        fv = subprocess.run(
            ["forge", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(CONTRACTS),
        )
        _log(
            "H2_forge_version",
            "forge --version",
            {
                "returncode": fv.returncode,
                "stdout": (fv.stdout or "").strip()[:300],
                "stderr": (fv.stderr or "").strip()[:300],
            },
        )
    except Exception as e:
        _log("H2_forge_version", "forge version failed", {"error": str(e)})

    # H3: forge verify-contract (same flags you use); capture output — may still NOTOK from explorer
    env = os.environ.copy()
    env.setdefault("ETHERSCAN_API_KEY", api_key)
    cmd = [
        "forge",
        "verify-contract",
        addr,
        contract,
        "--chain",
        "opbnb-testnet",
        "--verifier",
        "etherscan",
        "--verifier-url",
        f"https://api.etherscan.io/v2/api?chainid={chain_id}",
        "--etherscan-api-key",
        api_key,
        "--compiler-version",
        "v0.8.24+commit.e11b9ed9",
        "--via-ir",
    ]
    _log(
        "H3_forge_verify_invocation",
        "starting forge verify-contract",
        {"cmd_redacted": _redact_cmd_for_log(cmd)},
    )
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(CONTRACTS),
            env=env,
        )
        out = (proc.stdout or "") + "\n" + (proc.stderr or "")
        _log(
            "H3_forge_verify_result",
            "forge verify-contract finished",
            {
                "returncode": proc.returncode,
                "output_tail": out[-4000:],
            },
        )
    except subprocess.TimeoutExpired:
        _log("H3_forge_verify_result", "forge verify-contract timeout", {"timeout_s": 180})
    except Exception as e:
        _log("H3_forge_verify_result", "forge verify-contract exception", {"error": str(e)})

    print(f"Wrote NDJSON evidence to {LOG_PATH}")


if __name__ == "__main__":
    main()
