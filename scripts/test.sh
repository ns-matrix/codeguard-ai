#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "==> Backend fast tests"
(
  cd backend
  if [[ -x .venv/bin/python ]]; then PY=.venv/bin/python; else PY=python3; fi
  export TEST_DB_PASSWORD="${TEST_DB_PASSWORD:-postgres}"
  "$PY" -m pytest -q -m "not llm and not integration"
) || fail=1

echo "==> Frontend typecheck + build"
(
  cd frontend
  npm run build
) || fail=1

if [[ $fail -ne 0 ]]; then
  echo "TESTS FAILED"
  exit 1
fi
echo "All checks passed."
