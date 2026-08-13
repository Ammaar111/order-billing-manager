#!/usr/bin/env bash
# Everything the shop needs, in one command: build the front end if it is
# missing, start the one server, open the browser at it.
set -e
cd "$(dirname "$0")"

PORT="${PORT:-4100}"
URL="http://localhost:$PORT"

open_browser() {
  ( sleep "${1:-0}"
    command -v xdg-open >/dev/null && xdg-open "$URL" >/dev/null 2>&1 || true
  ) &
}

# The desktop icon will be double-clicked again while the shop is already open.
# Binding the port a second time would crash with EADDRINUSE and look like the
# app is broken, so an already-running server just gets the browser pointed at
# it instead.
if curl -sf --max-time 2 "$URL/api/settings" >/dev/null 2>&1; then
  echo "Order Bill Manager is already running → $URL"
  open_browser 0
  sleep 2
  exit 0
fi

if [ ! -d backend/node_modules ]; then
  echo "Installing the backend…"
  npm --prefix backend install --no-audit --no-fund
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installing the front end…"
  npm --prefix frontend install --no-audit --no-fund
fi

if [ ! -d frontend/dist ]; then
  echo "Building the front end…"
  npm --prefix frontend run build
fi

echo "Order Bill Manager → $URL"
echo "Leave this window open while the shop is billing."
echo

open_browser 1.5

PORT="$PORT" node backend/server.js
