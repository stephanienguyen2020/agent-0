# Changelog

All notable changes to Execution Market are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- **Scripts:** [`scripts/deploy-contracts.ts`](scripts/deploy-contracts.ts) — define `__dirname` via `import.meta.url` / `fileURLToPath` so `npm run deploy-contracts` works under **ESM** (`"type": "module"` in [`scripts/package.json`](scripts/package.json)); `__dirname` is not defined in ESM and previously threw at startup.
- Backend: when `publishTaskX402` **simulation** reverts but the RPC returns **no revert data**, map the failure to **`PreflightRejected` (HTTP 400)** with guidance instead of an opaque **502**. Detect likely **proxy vs implementation** by bytecode length and whether **`publishTaskX402`** selector **`0x421bbe07`** appears at `EM_ESCROW_ADDRESS`. **`totalUSDCCommitted()`** preflight read now falls back to **`eth_getStorageAt`** on **any** read exception (not only `ContractLogicError`), recording a short `totalUSDCCommitted_call_error` hint when that happens.

### Added

- **Scripts:** [`scripts/test_publish_task_flow.py`](scripts/test_publish_task_flow.py) — loads repo-root `.env`, signs EIP-3009 with `PUBLISH_TEST_REQUESTER_PRIVATE_KEY` using `em_api.services.x402_signer`, `GET /api/v1/tasks/escrow-fee-bps` for fee math, `POST /api/v1/tasks` with `X-PAYMENT` (same path as browser x402 publish). Documented `PUBLISH_TEST_REQUESTER_PRIVATE_KEY` in [`.env.example`](.env.example).
- Backend: **`GET /api/v1/tasks/escrow-fee-bps`** returns deployed **`feeBps`** from **EMEscrow** (fallback to **`ESCROW_FEE_BPS`** when RPC/ABI read fails). Used so EIP-3009 **`value`** matches **`publishTaskX402`** accounting.
- **DevOps:** Root [`docker-compose.yml`](docker-compose.yml) service **`facilitator`** builds [`facilitator/Dockerfile`](facilitator/Dockerfile) and exposes **8402** using repo-root `.env`; [README](README.md) quick start + [`facilitator/README.md`](facilitator/README.md) document `docker compose up facilitator` and `curl …/healthz`.
- Backend: **`GET /api/v1/world-id/status?wallet=...`** returns persisted `verification_level` (`device` \| `orb` \| null) from `world_id_proofs`.
- Frontend: **`/register`** loads World ID status via TanStack Query; info banner when already verified; Device / Orb chips and **Verify with World ID** disabled when the current level already satisfies the selection; query invalidated after successful verify.
- Frontend: **`/verification`** — World ID status dashboard (signing address, level-specific messaging, task eligibility summary, Device vs Orb FAQ, CTA to Register); sidebar **Verification** navigates to `/verification` (replaces disabled stub).
- Frontend: **`/tasks/new`** — publish-task form (`POST /api/v1/tasks`): title, instructions, category, USDC bounty, deadline; 13% escrow fee breakdown; EIP-3009 `TransferWithAuthorization` via wagmi `useSignTypedData` + base64 **`X-PAYMENT`** when `NEXT_PUBLIC_MOCK_USDC_ADDRESS` and `NEXT_PUBLIC_EM_ESCROW_ADDRESS` are set; optional dev-only **`NEXT_PUBLIC_ALLOW_X402_SKIP`** + `X-PAYMENT-SKIP: 1` when the API runs in development; `createTask()` in [`frontend/lib/api.ts`](frontend/lib/api.ts). Market **Post task** and My Tasks **Post New Task** link to `/tasks/new`.
- Frontend: **`/wallet`** — MockUSDC **live balance** (`balanceOf`) and **faucet** (`mint`) when `NEXT_PUBLIC_MOCK_USDC_ADDRESS` is set; default mint **1000 USDC** (6 decimals), override with **`NEXT_PUBLIC_FAUCET_MINT_MICROS`** (µUSDC); requires **tBNB** for gas on opBNB Testnet ([`frontend/lib/mock-usdc-abi.ts`](frontend/lib/mock-usdc-abi.ts)).
- Frontend: **opBNB Testnet (5611) enforcement** — [`SyncOpBNBChain`](frontend/components/wallet/SyncOpBNBChain.tsx) requests a wallet switch once after login when MetaMask is on another chain; [`AvatarChip`](frontend/components/AvatarChip.tsx) shows **Use opBNB Testnet** when mismatched; [`PostTaskForm`](frontend/app/tasks/new/PostTaskForm.tsx) calls `switchChain` before EIP-3009 `signTypedData` so viem chainId matches the typed-data domain (fixes external wallets left on e.g. XRPL EVM Testnet).
- **Frontend (AgentZero UI):** Ported `files/*.html` into Next.js — `AppShell` with sidebar + active routes, `Topbar` + `AvatarChip` (Privy/wagmi), Manrope / JetBrains Mono, `az-*` design tokens and glass cards; dashboard stats/charts on `/`; market grid + filters on `/tasks`; `/my-tasks` with tabs, lifecycle bar, and task table; `/agents` directory (demo cards); `/wallet` with native balance (`useBalance`) and placeholder escrow/USDC; leaderboard podium + table (stub until Supabase view). New routes: `/my-tasks`, `/agents`, `/wallet`.
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

### Fixed

- **`POST /api/v1/tasks` (x402):** When **`totalUSDCCommitted()`** **`eth_call`** fails, backend reads **`totalUSDCCommitted`** via **`eth_getStorageAt`** (`EMESCROW_COMMITTED_STORAGE_SLOT`, default **3** per Forge layout) so **`InsufficientFreeUSDC`** surfaces as **400** with balances instead of a blind **502**.
- **`POST /api/v1/tasks` (x402):** Preflight performs **bytecode-at-address** checks and labels which **`feeBps` / `usdc` / … view** fails when **`ContractLogicError`** implies **wrong `EM_ESCROW_ADDRESS` or chain/RPC**.
- **`POST /api/v1/tasks` (x402):** On-chain **preflight** (EM_AGENT_ROLE, paused, deadline vs block time, `totalUSDCCommitted` + `feeBps` vs USDC `balanceOf(escrow)`, `chain_id` vs RPC) runs before **`publishTaskX402`**; actionable failures return **400** via **`PreflightRejected`** instead of generic **502**.
- **`POST /api/v1/tasks`** (`publishTaskX402`): **`ContractLogicError` / `estimate_gas`** when on-chain **`feeBps`** did not match **`ESCROW_FEE_BPS`** — the escrow recomputes fee from the contract while x402 settle used the wallet-signed **`value`**. **`create_task`** now derives fee from **`feeBps()`** on deployed **EMEscrow**, and **`PostTaskForm`** loads the same **`fee_bps`** via **`getEscrowFeeBps()`** before signing EIP-3009.
- **`agent_to_agent`** category mapped to escrow enum index **4** (**DigitalPhysical**) so **`category_to_uint`** no longer raises **500**.
- Backend: **`publish_task`** / **`publish_task_x402`** **`ContractLogicError`** → **502** with hints instead of raw **500** tracebacks.
- **x402 facilitator:** Load the monorepo root **`.env`** (and optional `facilitator/.env`) on startup via **`python-dotenv`**, so **`FACILITATOR_PRIVATE_KEY`** and other vars match the FastAPI backend when running `uvicorn` locally — fixes **503 `FACILITATOR_PRIVATE_KEY not configured`** despite a correct root `.env`.
- Backend: **`POST /api/v1/tasks`** — when **`settle_payment`** cannot connect to the facilitator (`httpx.RequestError`), return **503** (was 502) with a short hint to run **`docker compose up facilitator`** / align **`X402_FACILITATOR_URL`** (see [`facilitator/README.md`](facilitator/README.md)).
- Frontend: Publish task x402 signing no longer trusts wagmi `useChainId()` alone for switching networks — **`eth_chainId`** from the injected provider is used so MetaMask can still be on chain **1449000** while React state shows **5611**; after `switchChain`, the code **waits** until the injected chain is **5611** before `signTypedData` (avoids viem “Provided chainId 5611 must match the active chainId 1449000”).
- Backend: **`POST /api/v1/tasks`** treats **`X402_ENFORCE=false`** as compatible with an optional **`X-PAYMENT`** header — if the client sends `X-PAYMENT`, the API now runs **settle + `publishTaskX402`** instead of **`publishTask`** (`transferFrom` requester), which reverted during gas estimation when the requester had not **approved** MockUSDC to the escrow (fixes 500 / browser “Failed to fetch” when signing x402 with default env).

### Changed

- **Frontend:** [`createTask`](frontend/lib/api.ts) surfaces FastAPI **`detail`** via **`parseFastApiDetail`** instead of raw JSON on errors; [`PostTaskForm`](frontend/app/tasks/new/PostTaskForm.tsx) uses **`whitespace-pre-wrap`** for multi-line API errors (e.g. facilitator hints).
- **Frontend:** `/register` main column uses the full width of the shell content area (removed `max-w-3xl`); hero intro uses `max-w-4xl` for readable line length on wide screens.
- **Frontend:** `/register` — AgentZero-style hero strip, main flow inside `Card`, developer env documentation in a collapsible `<details>`; `RegisterFlow` uses `BtnPrimary`, device vs Orb chip toggle, signing-address panel, and bordered success/error alerts; Privy-disabled state uses a consistent notice panel.
- **Frontend:** Layout is sidebar + main content (replaces header-only nav); metadata/title use AgentZero branding; `next.config.ts` adds `outputFileTracingRoot` for correct file tracing when multiple lockfiles exist.
- **Contracts:** Redeploy **EMEscrow** required to pick up `publishTaskX402` / `totalUSDCCommitted` (existing `publishTask` unchanged for callers but updates committed balance tracking).
- **Backend:** `BACKEND_PUBLIC_URL` / `backend_public_url` for x402 `resource` in 402 responses; `eth-account` dependency for EIP-712 signing helpers.
- Renamed `docs/02-technical-architecture (1).md` to `docs/02-technical-architecture.md` for consistent cross-links.
- World ID default action id set to `register-executor` (backend default + `.env.example`); added `frontend/.env.example`.
- Frontend wallet stack: **Privy** (per sprint plan); optional peers `@metamask/connect-evm`, `@farcaster/mini-app-solana` for Next bundle resolution.
- Docs `09` / `05`: note Privy + World ID v4 env (RP ID + signing key).

### Fixed

- World ID register: freeze the wallet used as IDKit `signal` when opening verification (`boundSignal` via `getAddress`) and POST the same checksummed address; skip redundant local `signal_hash` vs wallet check after successful **v4** Developer verify (`WORLD_ID_RP_ID` set), since protocol 3.x payloads can omit or relocate `signal_hash` on `responses[0]` while World already validated the proof.
- World ID: reject IDKit **3.x/4.x** proofs when `WORLD_ID_RP_ID` is missing on the API (503 with a clear message) instead of incorrectly calling the **v2** verify endpoint, which caused `invalid_action` / "Action not found." Documented that `WORLD_ID_RP_ID` must be set in repo root or `backend/.env` for FastAPI, matching `frontend/.env`.
- Frontend: `suppressHydrationWarning` on root `<html>` and `<body>` so browser extensions that inject attributes (e.g. Phia `data-phia-extension-fonts-loaded`) do not trigger React hydration mismatch warnings in dev.
- Backend: `Settings` loads the monorepo root `.env` and then `backend/.env` (when present) so `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` resolve when uvicorn’s cwd is `backend/`.
- Frontend build: internal navigation uses `next/link` per ESLint `no-html-link-for-pages`.
