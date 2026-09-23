#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for name in .backend.pid .frontend.pid; do
  path="$ROOT/$name"
  if [[ -f "$path" ]]; then
    pid="$(cat "$path" | head -n1 | tr -d '[:space:]')"
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      kill "$pid" 2>/dev/null || true
      echo "Stopped $name PID $pid"
    fi
    rm -f "$path"
  fi
done

pkill -f "uvicorn.*app.main:app" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
echo "Stopped."
