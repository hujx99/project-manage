#!/usr/bin/env sh
set -eu

: "${BACKEND_PORT:=18000}"
: "${SQLITE_DB_PATH:=.local/playwright-e2e.db}"
export SQLITE_DB_PATH

if [ -x "./.venv312/bin/python" ]; then
  PYTHON_BIN="./.venv312/bin/python"
elif [ -x "./.venv/bin/python" ]; then
  PYTHON_BIN="./.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python)"
else
  echo "Python executable not found" >&2
  exit 1
fi

exec "$PYTHON_BIN" -m uvicorn backend.app.main:app --host 127.0.0.1 --port "$BACKEND_PORT"
