#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v claude >/dev/null 2>&1; then
  echo "ERROR: 'claude' CLI not found on PATH."
  echo "  Install Claude Code: https://docs.claude.com/en/docs/claude-code/quickstart"
  exit 1
fi

# Auth note: this app shells out to the local `claude` CLI, which uses
# whatever auth the user already has set up (Claude Code subscription /
# `claude login`). We do NOT require ANTHROPIC_API_KEY to be set.

if [ ! -d node_modules ]; then
  echo "Installing server deps..."
  npm install
fi

if [ ! -d client/node_modules ]; then
  echo "Installing client deps..."
  (cd client && npm install)
fi

if [ ! -d templates/base/node_modules ]; then
  echo "Installing session-template deps (one-time)..."
  (cd templates/base && npm install)
fi

mkdir -p data

echo "Starting server on http://localhost:3001 ..."
npm run server &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Stopping server (pid $SERVER_PID) ..."
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# give the server a moment so the first /api request doesn't 503
sleep 1

echo "Starting client on http://localhost:5173 ..."
# In Docker, set HOST_BIND=0.0.0.0 so the published port is reachable from
# the host browser. Locally, the default 127.0.0.1 keeps Vite localhost-only.
HOST_BIND="${HOST_BIND:-127.0.0.1}"
(cd client && npm run dev -- --host "$HOST_BIND")
