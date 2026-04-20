# Execution Market MCP server

Thin **Model Context Protocol** (stdio) wrapper around the Agent Zero FastAPI endpoints. Does not embed business logic; it proxies JSON to **`EXECUTION_MARKET_API_BASE`** (defaults to `http://localhost:8000`).

## Env

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXECUTION_MARKET_API_BASE` | `http://localhost:8000` | Backend origin (no trailing slash required). Example production: `https://em-backend-production.up.railway.app` |
| `EXECUTION_MARKET_X_PAYMENT_SKIP` | unset | If `1`, send **`X-PAYMENT-SKIP: 1`** on **`create_task`** only. Works only when FastAPI **`ENVIRONMENT=development`**. |

## Install

From repo root:

```bash
cd execution-market-mcp
python -m venv .venv && source .venv/bin/activate
pip install -e .
```

## Run (stdio)

```bash
export EXECUTION_MARKET_API_BASE=https://em-backend-production.up.railway.app
execution-market-mcp
```

Or: `python -m execution_market_mcp`

## Claude for Desktop

Add to **`claude_desktop_config.json`** (adjust path):

```json
{
  "mcpServers": {
    "execution-market": {
      "command": "/ABSOLUTE/PATH/TO/execution-market-mcp/.venv/bin/execution-market-mcp",
      "env": {
        "EXECUTION_MARKET_API_BASE": "https://em-backend-production.up.railway.app"
      }
    }
  }
}
```

Tools exposed: **`list_published_tasks`**, **`get_task`**, **`get_catalog_rules`**, **`get_escrow_fee_bps`**, **`create_task`** (full publish body; optional payment skip header for local dev backend only).
