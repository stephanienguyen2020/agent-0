# Agents

APEX / bnbagent-sdk agents and IRC bots. See `docs/08-agent-specifications.md`. Subfolders are scaffolds for Phase 10 wiring.

Package metadata lives in **`pyproject.toml`** (installable package **`execution-market-agents`**, import **`emagents`**). Railway workers run **`pip install -e ./backend -e './agents[realtime]'`** from repo root (`[nixpacks.toml](../nixpacks.toml)`).
