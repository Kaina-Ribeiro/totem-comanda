#!/usr/bin/env bash
# Runs on tty1 after autologin (installed as /usr/local/bin/comanda-kiosk).
# Starts Cage with Chromium in kiosk mode and restarts it if it ever exits.
set -u

# shellcheck source=/dev/null
. /etc/default/comanda-kiosk

PROFILE_DIR="$HOME/.config/comanda-chromium"

# shellcheck disable=SC2054 # the comma belongs to --disable-features' value
chromium_args=(
  --kiosk
  --ozone-platform=wayland
  --user-data-dir="$PROFILE_DIR"
  --no-first-run
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=Translate,TouchpadOverscrollHistoryNavigation
  --overscroll-history-navigation=0
  --disable-pinch
  --password-store=basic
  --check-for-update-interval=31536000
)
if [ -n "${INSECURE_ORIGIN:-}" ]; then
  chromium_args+=(--unsafely-treat-insecure-origin-as-secure="$INSECURE_ORIGIN")
fi
if [ "${DEBUG:-0}" = "1" ]; then
  chromium_args+=(--remote-debugging-port=9222 --remote-allow-origins=*)
fi

# Inside Cage: rotate the output if asked, then hand over to Chromium.
# shellcheck disable=SC2016 # expanded by the inner shell, inside Cage
inner='
  if [ "${ROTATE:-0}" != "0" ]; then
    output="$(wlr-randr | head -n 1 | cut -d " " -f 1)"
    wlr-randr --output "$output" --transform "$ROTATE"
  fi
  exec chromium "$@"
'

while true; do
  # A crash or a closed window brings Chromium back after 2 s; the guest never
  # sees a desktop.
  ROTATE="${ROTATE:-0}" cage -- sh -c "$inner" chromium "${chromium_args[@]}" "$KIOSK_URL"
  sleep 2
done
