# x402 facilitator (Python)

Self-hosted **EIP-3009** helper for MockUSDC on opBNB Testnet: verifies typed-data signatures and submits `transferWithAuthorization` (gas paid by the facilitator EOA).

## Run locally

On startup, the app loads the **monorepo root** `.env` (and optional `facilitator/.env` if present) via `python-dotenv`, same as pointing Docker at `env_file`. You do not need to `export` every variable if they are already in the root `.env`.

```bash
cd facilitator
pip install -r requirements.txt
export OPBNB_RPC_URL=https://opbnb-testnet-rpc.bnbchain.org
export CHAIN_ID=5611
export MOCK_USDC_ADDRESS=0x...
export EM_ESCROW_ADDRESS=0x...
export FACILITATOR_PRIVATE_KEY=0x...   # funded with tBNB for gas
uvicorn app.main:app --host 0.0.0.0 --port 8402
```

Point the API at it with `X402_FACILITATOR_URL=http://localhost:8402` (see root `.env.example`).

## Docker Compose (monorepo root)

If you already have a repo-root `.env` with `MOCK_USDC_ADDRESS`, `EM_ESCROW_ADDRESS`, `FACILITATOR_PRIVATE_KEY`, and `OPBNB_RPC_URL` (same as the backend), run:

```bash
docker compose up facilitator
```

This builds [`Dockerfile`](Dockerfile) and listens on **8402**. Verify with `curl -s http://localhost:8402/healthz`. The FastAPI app must use `X402_FACILITATOR_URL=http://localhost:8402` (default in `.env.example`).

## Docker

```bash
docker build -t em-x402-facilitator .
docker run --rm -p 8402:8402 \
  -e MOCK_USDC_ADDRESS=... -e EM_ESCROW_ADDRESS=... \
  -e FACILITATOR_PRIVATE_KEY=... \
  em-x402-facilitator
```

See `docs/11-x402-integration.md` and `docs/15-deployment-devops.md` for protocol details and Railway-style deploy.
