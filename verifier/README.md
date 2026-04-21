# Verifier pipeline

Python package: `from verifier.pipeline import run`. Used by VerifierBot / backend jobs per `docs/14-verification-pipeline.md`.

L2 AI review: **`gemini`** (`levels/level2_gemini.py`) by default; **`dgrid`** (`level2_dgrid.py`) or **`dgrid_x402`** (`level2_dgrid_x402.py`) via **`VERIFY_L2_PROVIDER`** ([`docs/dgrid-integration.md`](../docs/dgrid-integration.md), [`.env.example`](../.env.example)).
