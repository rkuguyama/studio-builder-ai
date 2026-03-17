#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting Studio AI Builder (headless)"

# Generate runtime config as a separate JS file.
# This avoids brittle sed replacements and safely handles special characters.
RUNTIME_CONFIG_JSON="$(node -e 'const cfg={BRIDGE_URL:process.env.BRIDGE_URL||"http://localhost:4310",BRIDGE_TOKEN:process.env.DYAD_WEB_BRIDGE_TOKEN||""}; process.stdout.write(JSON.stringify(cfg));')"
printf 'window.__RUNTIME_CONFIG__ = %s;\n' "$RUNTIME_CONFIG_JSON" > /data/web-studio/runtime-config.js

# Ensure data directories exist
mkdir -p "$DYAD_DATA_DIR" "$DYAD_APPS_DIR"

# Start Xvfb (virtual framebuffer) for Electron (idempotent)
if ! pgrep -x Xvfb >/dev/null 2>&1; then
  rm -f /tmp/.X99-lock
  Xvfb :99 -screen 0 1024x768x24 -nolisten tcp &
  sleep 1
fi

# Start nginx to serve the web studio and reverse-proxy the bridge
nginx

# Resolve app binary (packaging can produce different executable names)
APP_BIN="${APP_BIN:-}"
if [[ -z "$APP_BIN" ]]; then
  for candidate in \
    "/opt/studio/dyad" \
    "/opt/studio/Studio AI Builder" \
    "/opt/studio/studio-ai-builder"
  do
    if [[ -x "$candidate" ]]; then
      APP_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "$APP_BIN" ]]; then
  for candidate in /opt/studio/*; do
    if [[ -f "$candidate" && -x "$candidate" ]]; then
      APP_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "$APP_BIN" ]]; then
  echo "ERROR: Could not find executable binary in /opt/studio"
  ls -la /opt/studio || true
  exit 1
fi

echo "==> Launching app binary: $APP_BIN"
exec "$APP_BIN" \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer
