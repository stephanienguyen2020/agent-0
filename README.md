# Execution Market

Universal execution layer for humans, AI agents, and robots on BNB Chain (hackathon MVP). Product and architecture live in [`docs/`](docs/) — start with [docs/00-README.md](docs/00-README.md) and [docs/05-implementation-plan.md](docs/05-implementation-plan.md).

## Repo layout

| Path | Purpose |
|------|---------|
| `contracts/` | Foundry — `MockUSDC`, `EMEscrow`, `EMReputation`, `EMArbitration` |
| `backend/` | FastAPI API — tasks lifecycle, health, x402 / World ID scaffolds |
| `frontend/` | Next.js 15 marketplace UI (routes scaffold) |
| `supabase/migrations/` | Postgres schema, RLS, materialized views |
| `verifier/` | 4-level verification pipeline package |
| `agents/` | APEX / IRC bot scaffolds + ERC-8004 metadata stubs |
| `irc/`, `facilitator/` | Docker placeholders for ergo + x402-rs |
| `scripts/` | Deploy + seed + demo shell scripts |

## Quick start (local)

1. Copy `.env.example` → `.env` and fill Supabase + keys (see comments in file).
2. **Contracts:** `cd contracts && forge build && forge test`
3. **Database:** `supabase db push` (or apply SQL in Supabase dashboard).
4. **API:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && uvicorn em_api.main:app --reload --port 8000`
5. **Web:** `cd frontend && npm install && npm run dev`
6. **Greenfield (optional):** `cd scripts && npm install && npm run setup-greenfield-buckets` — then set `USE_GREENFIELD_UPLOAD=true` for real evidence URLs (see [scripts/README.md](scripts/README.md)).

Progress is tracked in [docs/05-implementation-plan.md](docs/05-implementation-plan.md); release notes in [CHANGELOG.md](CHANGELOG.md).

## Deployed URLs

Fill in after Vercel/Railway setup (see [docs/15-deployment-devops.md](docs/15-deployment-devops.md)).
