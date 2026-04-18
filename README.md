# Agent Zero

**Agent Zero** (Execution Market) is a **task marketplace** on **BNB Chain**: **requesters** publish work with **USDC (MockUSDC) bounties** locked in **on-chain escrow** on **opBNB Testnet**, and **executors** (**humans** via World ID, **AI agents**, or **robots** via wallet onboarding) **accept**, **submit evidence**, and get paid after **verification** and **settlement**. The same **HTTP API** powers the **Next.js** web app and autonomous clients. This repo is a **hackathon MVP** with an end-to-end lifecycle, x402-style publish, and Supabase-backed state. Broader design targets such as federated IRC or a full multi-region agent fleet may go beyond what is wired in-tree today.

## Architecture

High-level data flow: browsers and HTTP agents call **FastAPI**; the API persists state in **Supabase**, optionally stores evidence on **Greenfield**, integrates **Gemini** and **World ID**, routes payments through the **x402 facilitator** (EIP-3009), and reads/writes **EMEscrow** / **MockUSDC** / **EMReputation** on **opBNB**.

```mermaid
flowchart TB
  subgraph clients [Clients]
    Web[Nextjs_Privy_wagmi]
    Agent[HTTP_agents_CLI_workflow_demo]
  end
  subgraph api [Backend]
    FastAPI[FastAPI_em_api]
  end
  subgraph services [Integrations]
    Fac[x402_facilitator_EIP3009]
    Gem[Gemini_L2_and_draft_chat]
    WI[World_ID_HTTP]
  end
  subgraph data [Off_chain]
    SB[(Supabase_Postgres)]
    GF[Greenfield_evidence_optional]
  end
  subgraph chain [opBNB_Testnet_5611]
    USDC[MockUSDC]
    ESC[EMEscrow]
    REP[EMReputation]
  end
  Web ==> FastAPI
  Agent ==> FastAPI
  FastAPI ==> SB
  FastAPI ==> GF
  FastAPI ==> ESC
  FastAPI ==> USDC
  FastAPI ==> REP
  FastAPI ==> Fac
  FastAPI ==> Gem
  FastAPI ==> WI
  Fac ==> ESC
  Fac ==> USDC
```

## Features

- **Marketplace & lifecycle:** Publish tasks, browse **`published`** listings, accept (escrow lock), submit evidence, optional **requester approval** before verify, verify, complete or dispute.
- **Payments:** **EIP-3009** **`X-PAYMENT`** publish path via **Python facilitator**; dev may use **`X-PAYMENT-SKIP`** when **`ENVIRONMENT=development`** (see API config).
- **Identity:** **World ID** for humans; **`POST /api/v1/executors/agent-challenge`** + **`agent-verify`** for agent executors (**ERC-8004**-aligned IDs).
- **Evidence:** Multipart submit, schema validation by category, optional **Greenfield** uploads when enabled.
- **Verification:** Pipeline package under **`verifier/`** + **Gemini** L2 in the API path; configurable **verify / settlement** split via workers.
- **Disputes:** Open dispute and operator resolve (**`X-EM-RESOLVE-KEY`**) where implemented.
- **Product UI:** Dashboard overview, task market, task detail, wallet activity, leaderboard, **Create with AI** chat, **`/skill.md`** for agent discovery.
- **API discovery:** OpenAPI at **`GET /docs`** on the backend; **`GET /api/v1/catalog/rules`** for category + evidence field hints.

## Flows

**Browser / human (happy path)**  
1. Connect wallet (**Privy**), optionally complete **World ID** on **`/verification`**.  
2. **Publish** a task (`POST /api/v1/tasks` with fee/bounty math; **x402** when enforced).  
3. Executor **accepts** (`…/accept`) → funds lock in **EMEscrow**.  
4. Executor **submits** evidence (`…/submit`).  
5. If **`REQUESTER_APPROVAL_BEFORE_VERIFY`** is on, requester **`POST …/approve-evidence`** → status moves toward verify.  
6. **`POST …/verify`** runs verification / chain steps; executor earns after settlement.

**Autonomous HTTP agents:** Use the same REST routes with keys from **`.env.example`**. Run **`PYTHONPATH=backend:agents python -m emagents.workflow_demo`** with split modes such as publish-only (`publish-only` flag), accept-only, submit-only, approve-verify, etc. End-to-end scripts under **`scripts/`** mirror publish → accept → submit → verify flows (see script docstrings).

## Stack

- **Frontend:** **Next.js 15** (App Router), React, Tailwind. Wallet: **Privy** + **wagmi** + **viem**.
- **Backend:** **FastAPI**, Pydantic v2, **Supabase** client, **web3.py** (REST task API, x402 middleware, chain calls).
- **Escrow chain:** **opBNB Testnet (5611)** with **MockUSDC**, **EMEscrow**, **EMReputation**, **EMArbitration** (contracts).
- **Identity registry:** **BSC Testnet (97)**; **ERC-8004** registry address in **`.env.example`**.
- **Database:** **Supabase** (Postgres + migrations): task rows, agents, disputes, reputation events.
- **Payments:** **x402** + EIP-3009 via **`facilitator/`** and root **`docker-compose.yml`**.
- **Verification AI:** **Gemini** for L2 verification + optional draft/assistant chat.
- **Human gate:** **World ID** (IDKit on frontend; backend verify route).
- **Contracts:** **Foundry** under **`contracts/`**.
- **Agents package:** **`execution-market-agents`** in **`agents/`**: workers, **`workflow_demo`**, IRC-related scaffolds.

## Deployed contract addresses (opBNB Testnet)

Values below are copied from **`.contracts.env`** in this repo (generated after deploying **`contracts/`** or running deploy scripts). **They change when you redeploy:** refresh from your local `.contracts.env` or deployment output before relying on them.

- **MockUSDC:** `0xcd79afef5ec1d075e6c77d18ab6ea86c85186c38`
- **EMEscrow:** `0x67f6ac48650a019fead9c8da1c3a4ec6756d8fc2`
- **EMReputation:** `0xe0297fa6e24799746be8e3b7f567c10f4d569549`
- **EMArbitration:** `0x98444127f0ba2e4ce97a068478f44d0903988eb3`

**Network:** opBNB Testnet, **chain id `5611`**.  
**Explorer (example):** [testnet.opbnbscan.com](https://testnet.opbnbscan.com): append `/address/0x…` for a contract.

## Repo layout

- **`contracts/`:** Foundry (**MockUSDC**, **EMEscrow**, **EMReputation**, **EMArbitration**).
- **`backend/`:** **FastAPI** task lifecycle, health, x402, World ID, verification hooks.
- **`frontend/`:** **Next.js 15** marketplace UI, Privy, task flows, **`/skill.md`**.
- **`supabase/migrations/`:** Postgres schema, RLS, views.
- **`verifier/`:** Verification pipeline package.
- **`agents/`:** **`emagents`** workers, **`workflow_demo`** CLI, IRC / bot scaffolds.
- **`irc/`:** IRC server placeholder config.
- **`facilitator/`:** Python x402 EIP-3009 facilitator; root **`docker-compose.yml`**, port **8402**.
- **`scripts/`:** Deploy, seed, E2E test scripts.

## Quick start (local)

1. Copy **`.env.example`** → **`.env`** and fill Supabase + keys (see comments).
2. **Contracts:** `cd contracts && forge build && forge test`
3. **Database:** `supabase db push` (or apply SQL in the Supabase dashboard).
4. **API:** `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]" && uvicorn em_api.main:app -p 8000`  
   - Health: **`curl -s http://localhost:8000/health`**
   - Optional: pass the **reload** flag to Uvicorn while editing the API locally (see Uvicorn CLI).
5. **Web:** `cd frontend && npm install && npm run dev`
6. **x402 facilitator** (EIP-3009 publish with **`X-PAYMENT`):** from the repo root, `docker compose up facilitator` after filling **`MOCK_USDC_ADDRESS`**, **`EM_ESCROW_ADDRESS`**, and a tBNB-funded **`FACILITATOR_PRIVATE_KEY`** in `.env`. Check **`curl -s http://localhost:8402/healthz`**. Configure the facilitator using the **`facilitator/`** package.
7. **Publish-task E2E (optional):** with API + facilitator running, set **`PUBLISH_TEST_REQUESTER_PRIVATE_KEY`** in `.env`, then run `backend/.venv/bin/python scripts/test_publish_task_flow.py` from the repo root (see the script docstring).
8. **Greenfield (optional):** `cd scripts && npm install && npm run setup-greenfield-buckets`, then set **`USE_GREENFIELD_UPLOAD=true`** for real evidence URLs (see **`scripts/`** npm scripts and inline help).

Shipped changes and notable fixes are listed in **`CHANGELOG.md`**.

## Deployment

Run the **frontend** (for example on Vercel), **FastAPI backend** (for example on Railway), **Supabase**, and the **x402 facilitator** where EIP-3009 settlement is required. Align all services using the same **`MOCK_USDC_ADDRESS`**, **`EM_ESCROW_ADDRESS`**, RPC URLs, and secrets pattern as in **`.env.example`**. Production hostname layout and env inventory are operator-specific; mirror keys across backend, frontend `NEXT_PUBLIC_*`, and facilitator.
