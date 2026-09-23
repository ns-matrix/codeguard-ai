#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> CodeGuard AI setup"

if [[ "${1:-}" != "--frontend-only" ]]; then
  echo "==> Backend deps"
  (
    cd backend
    if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
    # shellcheck disable=SC1091
    source .venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    if [[ ! -f .env ]]; then
      cp .env.example .env
      echo "Created backend/.env from .env.example"
    fi
  )
fi

echo "==> Frontend deps"
(
  cd frontend
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
)

echo
echo "Setup complete."
echo "  ./scripts/dev.sh     # start backend + frontend"
echo "  ./scripts/test.sh    # fast tests + frontend build"
echo "  docker compose up --build"
