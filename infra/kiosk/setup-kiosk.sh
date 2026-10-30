#!/usr/bin/env bash
# Turns a fresh Debian (arm64) board into a Comanda kiosk: autologin on tty1,
# Cage (a single-app Wayland compositor) and Chromium in kiosk mode, no desktop.
#
# Usage, as root on the board, from this folder:
#   KIOSK_URL=https://kiosk.example.com/kiosk ./setup-kiosk.sh
#
# Optional:
#   ROTATE=90|180|270     rotate the screen if it does not report portrait natively
#   INSECURE_ORIGIN=http://192.168.1.23:3000
#                         LAN tests without HTTPS: lets Chromium treat that origin
#                         as secure, so the service worker can register
#   DEBUG=1               Chromium remote debugging on port 9222 (measurements)
#
# Re-running is safe: it rewrites the same files.
set -euo pipefail

: "${KIOSK_URL:?Set KIOSK_URL, e.g. KIOSK_URL=https://kiosk.example.com/kiosk}"
KIOSK_USER="${KIOSK_USER:-kiosk}"
ROTATE="${ROTATE:-0}"
INSECURE_ORIGIN="${INSECURE_ORIGIN:-}"
DEBUG="${DEBUG:-0}"
HERE="$(cd "$(dirname "$0")" && pwd)"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo)." >&2
  exit 1
fi

echo "==> Packages"
apt-get update
apt-get install -y --no-install-recommends cage chromium wlr-randr seatd fonts-noto-color-emoji

echo "==> User ${KIOSK_USER}"
if ! id -u "$KIOSK_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "$KIOSK_USER"
fi
for group in video render input _seatd; do
  if getent group "$group" >/dev/null; then usermod -aG "$group" "$KIOSK_USER"; fi
done
systemctl enable --now seatd

echo "==> Settings in /etc/default/comanda-kiosk"
cat >/etc/default/comanda-kiosk <<EOF
KIOSK_URL="${KIOSK_URL}"
ROTATE="${ROTATE}"
INSECURE_ORIGIN="${INSECURE_ORIGIN}"
DEBUG="${DEBUG}"
EOF

echo "==> Session launcher"
install -m 755 "$HERE/kiosk-session.sh" /usr/local/bin/comanda-kiosk

echo "==> Autologin on tty1"
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat >/etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${KIOSK_USER} --noclear %I \$TERM
EOF

# Start the kiosk only on the physical console, never on SSH logins.
cat >"/home/${KIOSK_USER}/.bash_profile" <<'EOF'
if [ "$(tty)" = "/dev/tty1" ]; then
  exec /usr/local/bin/comanda-kiosk
fi
EOF
chown "${KIOSK_USER}:" "/home/${KIOSK_USER}/.bash_profile"

# No console messages over the kiosk screen.
systemctl set-default multi-user.target

echo "==> Done. Reboot to start the kiosk: systemctl reboot"
