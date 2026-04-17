# Changelog

All notable changes to Execution Market are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **x402 (EIP-3009):** Python facilitator service in `facilitator/` (`POST /verify`, `POST /settle`, `GET /healthz`) with Dockerfile; backend `em_api.services.x402_signer`, `x402_facilitator`, `X402_ENFORCE` + dynamic 402 amounts on `POST /api/v1/tasks`, base64 `X-PAYMENT` validation and settle-before-publish flow.
- **EMEscrow:** `publishTaskX402` and `totalUSDCCommitted` accounting so USDC can arrive via EIP-3009 to the escrow before task creation (paired with x402 settle).
- Frontend: **Privy** + `@privy-io/wagmi` + TanStack Query, opBNB Testnet chain helper, header wallet controls, task detail **accept / multipart submit / verify** actions against FastAPI.
- World ID: IDKit v4 **IDKitRequestWidget** on `/register`, Next.js `POST /api/world-id/rp-context` (RP signing), backend verify forwards to World Developer API (v4 or legacy v2) and optional `signal_hash` check.
- Backend: World ID **accept gating** (device minimum; Orb for bounties ≥ threshold µUSDC); `WORLD_ID_ACCEPT_ENFORCE` to disable for local demos; `evidence_items` rows on submit; **`POST /tasks/{id}/verify`** runs verifier **pipeline** + real **Gemini 2.0 Flash** when `GEMINI_API_KEY` is set.
- `em_api.services.world_id_signal` (IDKit-compatible signal digest) and `em_api.services.verification` (repo-root `verifier` import).
- Initial monorepo skeleton: `contracts/` (Foundry), `frontend/` (Next.js 15), `backend/` (FastAPI), `agents/`, `irc/`, `facilitator/`, `scripts/`, `supabase/migrations/`.
- Root `.env.example` documenting configuration variables.
- Cursor rule to keep `docs/05-implementation-plan.md` progress and `CHANGELOG.md` updated.
- Smart contracts: `MockUSDC` (EIP-3009), `EMEscrow`, `EMReputation`, `EMArbitration` (scaffold) per `docs/03-smart-contracts.md`.
- Supabase SQL migrations (schema, RLS, materialized views, helpers) per `docs/07-database-schema.md`.
- FastAPI backend with health checks, task lifecycle API (publish → accept → submit → verify → release), category evidence validation, and x402 payment-requirements middleware scaffold.
- Verifier package (L1–L4 scaffolding) with Gemini L2 integration hook.
- IRC ergo Dockerfile/config stubs and pydle bot scaffolds.
- Frontend app routes: home, tasks, task detail, dashboards, register, profile, leaderboard, disputes.
- Demo/ops scripts: `deploy-contracts.ts`, `seed-demo.ts`, shell demo stubs.
- Greenfield: `scripts/setup-greenfield-buckets.ts`, `scripts/upload-greenfield.ts` (`@bnb-chain/greenfield-js-sdk` + Reed–Solomon), shared `scripts/lib/greenfield-bootstrap.ts`; optional `USE_GREENFIELD_UPLOAD` hooks multipart task submit to the upload CLI.
- Agent metadata JSON stubs and demo agent package layouts.

### Changed

- **Contracts:** Redeploy **EMEscrow** required to pick up `publishTaskX402` / `totalUSDCCommitted` (existing `publishTask` unchanged for callers but updates committed balance tracking).
- **Backend:** `BACKEND_PUBLIC_URL` / `backend_public_url` for x402 `resource` in 402 responses; `eth-account` dependency for EIP-712 signing helpers.
- Renamed `docs/02-technical-architecture (1).md` to `docs/02-technical-architecture.md` for consistent cross-links.
- World ID default action id set to `register-executor` (backend default + `.env.example`); added `frontend/.env.example`.
- Frontend wallet stack: **Privy** (per sprint plan); optional peers `@metamask/connect-evm`, `@farcaster/mini-app-solana` for Next bundle resolution.
- Docs `09` / `05`: note Privy + World ID v4 env (RP ID + signing key).

### Fixed

- Backend: `Settings` loads the monorepo root `.env` and then `backend/.env` (when present) so `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` resolve when uvicorn’s cwd is `backend/`.
- Frontend build: internal navigation uses `next/link` per ESLint `no-html-link-for-pages`.
