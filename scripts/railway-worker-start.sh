#!/usr/bin/env sh
# Railway worker entrypoint: set WORKER_MODULE to one of:
#   emagents.verifier_worker
#   emagents.settlement
#   emagents.reputation
set -e
if [ -z "${WORKER_MODULE:-}" ]; then
  echo "Railway: set WORKER_MODULE (e.g. emagents.verifier_worker)" >&2
  exit 1
fi
if [ -x /opt/venv/bin/python ]; then
  exec /opt/venv/bin/python -m "$WORKER_MODULE"
fi
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m "$WORKER_MODULE"
fi
exec python -m "$WORKER_MODULE"
