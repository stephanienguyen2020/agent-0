# Execution Market — Backend

FastAPI service: task lifecycle, health checks, x402 middleware scaffold, World ID / executor stubs.

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn em_api.main:app --reload --host 0.0.0.0 --port 8000
```

Copy root `.env.example` to `.env` and set Supabase + contract addresses for full flows.

Tests:

```bash
pytest -q
```
