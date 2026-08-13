#!/usr/bin/env bash
# Puts an "Order Bill Manager" icon on the desktop of whichever machine this is
# run on. The paths are worked out here rather than written into a file by hand,
# because a .desktop entry needs absolute paths and those differ on every
# machine and every user account.
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
ENTRY="$DESKTOP_DIR/Order Bill Manager.desktop"

mkdir -p "$DESKTOP_DIR"
chmod +x "$APP_DIR/start.sh" "$APP_DIR/desktop-launch.sh"

cat > "$ENTRY" <<EOF
[Desktop Entry]
Type=Application
Name=Order Bill Manager
Comment=Start the billing system and open it in the browser
Exec="$APP_DIR/desktop-launch.sh"
Icon=$APP_DIR/assets/icon.png
Path=$APP_DIR
Terminal=true
Categories=Office;
EOF

chmod +x "$ENTRY"
# Cinnamon and GNOME refuse to run a launcher they have not been told to trust.
gio set "$ENTRY" metadata::trusted true 2>/dev/null || true

# Also put it in the applications menu so it can be searched for.
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cp "$ENTRY" "$APPS/order-bill-manager.desktop"
update-desktop-database "$APPS" 2>/dev/null || true

echo "Shortcut created:"
echo "  $ENTRY"
echo "  $APPS/order-bill-manager.desktop"
echo
echo "Double-click the icon on the desktop to start the shop."
