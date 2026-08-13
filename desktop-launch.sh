#!/usr/bin/env bash
# What the desktop icon runs. Kept as its own file rather than inlined into the
# .desktop Exec line: the desktop-entry spec treats ; & and quotes as reserved,
# so a shell one-liner there is only working by the file manager's goodwill.
cd "$(dirname "$0")"

./start.sh

echo
echo "Order Bill Manager has stopped. Press Enter to close this window."
read -r
