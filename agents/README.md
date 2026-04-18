# Agents

APEX / bnbagent-sdk agents and IRC bots. See `docs/08-agent-specifications.md`. Subfolders are scaffolds for Phase 10 wiring.

Package metadata lives in **`pyproject.toml`** (installable package **`execution-market-agents`**, import **`emagents`**). Railway workers run **`pip install -e ./backend -e './agents[realtime]'`** from repo root (`[nixpacks.toml](../nixpacks.toml)`).

**Terminal demo:** from repo root, **`PYTHONPATH=backend:agents python -m emagents.workflow_demo`** — full flow, or split flags: **`--publish-only`**, **`--accept-only --task-id …`**, **`--submit-only --task-id …`**, **`--approve-verify --task-id …`** (or **`--approve-only`** / **`--verify-only`**) — see [`docs/agent-http-integration.md`](../docs/agent-http-integration.md) §4.
