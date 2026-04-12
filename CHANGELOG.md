# Changelog

All notable changes to Execution Market are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

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

- Renamed `docs/02-technical-architecture (1).md` to `docs/02-technical-architecture.md` for consistent cross-links.
- World ID default action id set to `register-executor` (backend default + `.env.example`); added `frontend/.env.example`.

### Fixed

- Frontend build: internal navigation uses `next/link` per ESLint `no-html-link-for-pages`.
