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
exec python -m "$WORKER_MODULE"
