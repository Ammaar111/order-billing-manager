#!/usr/bin/env bash
# Everything the shop needs, in one command: build the front end if it is
# missing, start the one server, open the browser at it.
set -e
cd "$(dirname "$0")"

# The desktop icon starts this from a shell that never reads ~/.bashrc, so nvm
# has not run and `node` is whatever /usr/bin holds — on this machine an older
# major version than the one node_modules was compiled against. better-sqlite3
# is a compiled binding and will not load across that line, so the app would die
# before it ever opened the database. Prefer the newest node nvm has.
#
# An `if`, not `[ … ] && …`: under `set -e` a failing test as the last command
# of the script's flow would end the launch rather than skip a line.
NVM_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$NVM_BIN" ]; then
  export PATH="$NVM_BIN:$PATH"
fi

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

# Upgrading Node leaves better-sqlite3 compiled for the version before it, and
# the app then fails with a NODE_MODULE_VERSION stack trace — true, and no use
# at all to whoever is standing at the counter. Repair it here instead.
#
# The check opens a database rather than just requiring the module: the binding
# is loaded lazily inside `new Database()`, so a bare require succeeds even when
# the compiled file is unusable.
if ! (cd backend && node -e 'new (require("better-sqlite3"))(":memory:")') >/dev/null 2>&1; then
  echo "Node has changed since this was installed. Preparing it again…"
  npm --prefix backend rebuild better-sqlite3
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
