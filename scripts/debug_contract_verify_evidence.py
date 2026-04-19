#!/usr/bin/env python3
"""
Probe Etherscan API v2 + run forge verify-contract (diagnostic output to stdout).

Run from repo root:  python3 scripts/debug_contract_verify_evidence.py
Requires: ETHERSCAN_API_KEY, contracts built, forge on PATH.
Optional: MOCK_USDC, CHAIN_ID (default 5611), CONTRACT_PATH (default src/MockUSDC.sol:MockUSDC)
"""

from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CONTRACTS = REPO / "contracts"


def _redact_cmd_for_log(cmd: list[str]) -> list[str]:
    """Never print secrets: mask the value after --etherscan-api-key."""
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
            print(
                "SSL verify failed; install certifi for Python probe "
                "(pip install certifi or run macOS Python Install Certificates.command)"
            )
            raise


def main() -> None:
    api_key = os.environ.get("ETHERSCAN_API_KEY", "").strip()
    if not api_key:
        print("Set ETHERSCAN_API_KEY (Etherscan v2 unified key).")
        return

    addr = os.environ.get("MOCK_USDC", "0xb5b64fbF816bFCA91094C53aC5606A960f91dB78").strip()
    chain_id = os.environ.get("CHAIN_ID", "5611").strip()
    contract = os.environ.get("CONTRACT_PATH", "src/MockUSDC.sol:MockUSDC").strip()

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
    print("--- Etherscan v2 getabi ---")
    try:
        raw = _urlopen_get(url).decode("utf-8", errors="replace")
        try:
            j = json.loads(raw)
        except json.JSONDecodeError:
            print("Parse error; raw prefix:", raw[:500])
        else:
            print(
                json.dumps(
                    {
                        "chainid": chain_id,
                        "address": addr,
                        "status": j.get("status"),
                        "message": j.get("message"),
                        "result_type": type(j.get("result")).__name__,
                        "result_prefix": (
                            str(j.get("result"))[:200] if j.get("result") is not None else None
                        ),
                    },
                    indent=2,
                )
            )
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:800]
        print(f"HTTPError {e.code}: {body}")
    except Exception as e:
        print(f"getabi exception: {e}")

    print("\n--- forge --version ---")
    try:
        fv = subprocess.run(
            ["forge", "--version"],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(CONTRACTS),
        )
        print(f"returncode={fv.returncode}")
        print((fv.stdout or "").strip()[:300])
        if fv.stderr:
            print("stderr:", (fv.stderr or "").strip()[:300])
    except Exception as e:
        print(f"forge version failed: {e}")

    print("\n--- forge verify-contract ---")
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
    print("cmd (redacted):", _redact_cmd_for_log(cmd))
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
        print(f"returncode={proc.returncode}")
        print("--- output (tail) ---")
        print(out[-4000:])
    except subprocess.TimeoutExpired:
        print("forge verify-contract timed out after 180s")
    except Exception as e:
        print(f"forge verify-contract exception: {e}")


if __name__ == "__main__":
    main()
