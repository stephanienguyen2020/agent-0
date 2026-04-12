#!/usr/bin/env bash
# Generate Etherscan / opBNBScan Standard JSON verification inputs for each
# deployed contract. Writes one JSON file per contract under
# contracts/verification-standard-json/
#
# Requires: forge, cast (Foundry). Loads repo root .env if present.
#
# Env (addresses must match the deployment you are verifying):
#   MOCK_USDC_ADDRESS, EM_REPUTATION_ADDRESS, EM_ARBITRATION_ADDRESS, EM_ESCROW_ADDRESS
#   EM_AGENT_ADDRESS, TREASURY_ADDRESS
#   DEPLOYER_ADDRESS or DEPLOYER_PRIVATE_KEY (to derive deployer for constructor encoding)
# Optional: ETHERSCAN_API_KEY (placeholder used if unset), CHAIN_ID (default 5611)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTRACTS="$ROOT/contracts"
OUT="$CONTRACTS/verification-standard-json"

mkdir -p "$OUT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

CHAIN_ID="${CHAIN_ID:-5611}"
KEY="${ETHERSCAN_API_KEY:-placeholder}"
VERIFIER_URL="https://api.etherscan.io/v2/api?chainid=${CHAIN_ID}"

: "${MOCK_USDC_ADDRESS:?Set MOCK_USDC_ADDRESS}"
: "${EM_REPUTATION_ADDRESS:?Set EM_REPUTATION_ADDRESS}"
: "${EM_ARBITRATION_ADDRESS:?Set EM_ARBITRATION_ADDRESS}"
: "${EM_ESCROW_ADDRESS:?Set EM_ESCROW_ADDRESS}"
: "${EM_AGENT_ADDRESS:?Set EM_AGENT_ADDRESS}"
: "${TREASURY_ADDRESS:?Set TREASURY_ADDRESS}"

if [[ -z "${DEPLOYER_ADDRESS:-}" ]]; then
  if [[ -n "${DEPLOYER_PRIVATE_KEY:-}" ]]; then
    DEPLOYER_ADDRESS="$(cast wallet address --private-key "$DEPLOYER_PRIVATE_KEY")"
  else
    echo "Set DEPLOYER_ADDRESS or DEPLOYER_PRIVATE_KEY" >&2
    exit 1
  fi
fi

cd "$CONTRACTS"
forge build --quiet

OPTS=(
  --chain opbnb-testnet
  --verifier etherscan
  --verifier-url "$VERIFIER_URL"
  --etherscan-api-key "$KEY"
  --compiler-version "v0.8.24+commit.e11b9ed9"
  --via-ir
)

forge verify-contract "${OPTS[@]}" "$MOCK_USDC_ADDRESS" src/MockUSDC.sol:MockUSDC \
  --show-standard-json-input >"$OUT/MockUSDC.json"

ENC_REP="$(cast abi-encode "constructor(address,address)" "$DEPLOYER_ADDRESS" "$EM_AGENT_ADDRESS")"
forge verify-contract "${OPTS[@]}" "$EM_REPUTATION_ADDRESS" src/EMReputation.sol:EMReputation \
  --constructor-args "$ENC_REP" --show-standard-json-input >"$OUT/EMReputation.json"

ENC_ARB="$(cast abi-encode "constructor(address,address)" "$DEPLOYER_ADDRESS" "$EM_AGENT_ADDRESS")"
forge verify-contract "${OPTS[@]}" "$EM_ARBITRATION_ADDRESS" src/EMArbitration.sol:EMArbitration \
  --constructor-args "$ENC_ARB" --show-standard-json-input >"$OUT/EMArbitration.json"

ENC_ESC="$(cast abi-encode "constructor(address,address,address,uint16,address)" \
  "$MOCK_USDC_ADDRESS" "$EM_AGENT_ADDRESS" "$TREASURY_ADDRESS" 1300 "$DEPLOYER_ADDRESS")"
forge verify-contract "${OPTS[@]}" "$EM_ESCROW_ADDRESS" src/EMEscrow.sol:EMEscrow \
  --constructor-args "$ENC_ESC" --show-standard-json-input >"$OUT/EMEscrow.json"

echo "Wrote:"
ls -1 "$OUT"/*.json
