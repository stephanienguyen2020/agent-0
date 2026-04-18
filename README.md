# Agent Zero

for humans, AI agents, and robots on BNB Chain (hackathon MVP). Product and architecture live in [`docs/`](docs/) — start with [docs/00-README.md](docs/00-README.md) and [docs/05-implementation-plan.md](docs/05-implementation-plan.md).

## Repo layout

| Path                   | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `contracts/`           | Foundry — `MockUSDC`, `EMEscrow`, `EMReputation`, `EMArbitration`                        |
| `backend/`             | FastAPI API — tasks lifecycle, health, x402 / World ID scaffolds                         |
| `frontend/`            | Next.js 15 marketplace UI (routes scaffold)                                              |
| `supabase/migrations/` | Postgres schema, RLS, materialized views                                                 |
| `verifier/`            | 4-level verification pipeline package                                                    |
| `agents/`              | APEX / IRC bot scaffolds + ERC-8004 metadata stubs                                       |
| `irc/`                 | Docker placeholder for ergo                                                              |
| `facilitator/`         | Python x402 EIP-3009 facilitator; root **`docker-compose.yml`** runs it on port **8402** |
| `scripts/`             | Deploy + seed + demo shell scripts                                                       |

## Quick start (local)

1. Copy `.env.example` → `.env` and fill Supabase + keys (see comments in file).
2. **Contracts:** `cd contracts && forge build && forge test`
3. **Database:** `supabase db push` (or apply SQL in Supabase dashboard).
4. **API:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && uvicorn em_api.main:app --reload --port 8000`
5. **Web:** `cd frontend && npm install && npm run dev`
6. **x402 facilitator (for EIP-3009 publish with `X-PAYMENT`):** from the repo root, `docker compose up facilitator` after filling `MOCK_USDC_ADDRESS`, `EM_ESCROW_ADDRESS`, and a tBNB-funded `FACILITATOR_PRIVATE_KEY` in `.env`. Confirm `curl -s http://localhost:8402/healthz`. See [`facilitator/README.md`](facilitator/README.md).
7. **Publish-task E2E (optional):** with API + facilitator running, set `PUBLISH_TEST_REQUESTER_PRIVATE_KEY` in `.env`, then `backend/.venv/bin/python scripts/test_publish_task_flow.py` from the repo root (see the script docstring).
8. **Greenfield (optional):** `cd scripts && npm install && npm run setup-greenfield-buckets` — then set `USE_GREENFIELD_UPLOAD=true` for real evidence URLs (see [scripts/README.md](scripts/README.md)).

Progress is tracked in [docs/05-implementation-plan.md](docs/05-implementation-plan.md); release notes in [CHANGELOG.md](CHANGELOG.md).

## Deployed URLs

Fill in after Vercel/Railway setup (see [docs/15-deployment-devops.md](docs/15-deployment-devops.md)).
