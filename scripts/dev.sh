#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT="${BACKEND_PORT:-8001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

cd backend
if [[ ! -f .env ]]; then cp .env.example .env; fi
if [[ -x .venv/bin/uvicorn ]]; then
  UV=.venv/bin/uvicorn
else
  UV=uvicorn
fi
"$UV" app.main:app --host 127.0.0.1 --port "$BACKEND_PORT" --reload &
BACK_PID=$!
echo $BACK_PID > "$ROOT/.backend.pid"

cd "$ROOT/frontend"
npm run dev -- --port "$FRONTEND_PORT" &
FRONT_PID=$!
echo $FRONT_PID > "$ROOT/.frontend.pid"

echo
echo "Backend:  http://127.0.0.1:$BACKEND_PORT/api/health"
echo "Swagger:  http://127.0.0.1:$BACKEND_PORT/docs"
echo "Frontend: http://127.0.0.1:$FRONTEND_PORT"
echo "Stop with: ./scripts/stop.sh"
wait
