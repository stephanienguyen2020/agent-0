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
