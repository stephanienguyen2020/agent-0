# Smart contracts (Foundry)

```bash
cd contracts
forge install   # if libs missing
forge build
forge test
```

Deploy to opBNB Testnet:

```bash
export DEPLOYER_PRIVATE_KEY=...
export EM_AGENT_ADDRESS=...
export TREASURY_ADDRESS=...
forge script script/Deploy.s.sol --rpc-url opbnb_testnet --broadcast -vvv
```

TypeScript deploy helper (after `forge build`):

```bash
cd ../scripts && npm install && npm run deploy-contracts
```

Addresses are written to `../.contracts.env`.

## Verify on opBNBScan (Etherscan API v2)

Use a unified key from [etherscan.io/apis](https://etherscan.io/apis) and **chain id 5611**:

```bash
export ETHERSCAN_API_KEY=...
forge verify-contract <ADDRESS> src/YourContract.sol:YourContract \
  --chain opbnb-testnet \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=5611" \
  --etherscan-api-key "$ETHERSCAN_API_KEY" \
  --compiler-version "v0.8.24+commit.e11b9ed9" \
  --via-ir \
  --watch
```

If the API responds with `General exception occured when attempting to insert record`, that is a **server-side explorer error**—retry later or verify manually: run the same command with `--show-standard-json-input > verify.json` and upload **Solidity Standard JSON** on [testnet.opbnbscan.com](https://testnet.opbnbscan.com).

Evidence / local SSL: `python3 ../scripts/debug_contract_verify_evidence.py` (prints diagnostics to stdout). If Python reports `CERTIFICATE_VERIFY_FAILED`, run `pip install certifi` or macOS **Install Certificates.command** for your Python.
