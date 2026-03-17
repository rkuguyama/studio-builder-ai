#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting Studio AI Builder (headless)"

# Generate runtime config as a separate JS file.
# This avoids brittle sed replacements and safely handles special characters.
RUNTIME_CONFIG_JSON="$(node -e 'const cfg={BRIDGE_URL:process.env.BRIDGE_URL||\"http://localhost:4310\",BRIDGE_TOKEN:process.env.DYAD_WEB_BRIDGE_TOKEN||\"\"}; process.stdout.write(JSON.stringify(cfg));')"
printf 'window.__RUNTIME_CONFIG__ = %s;\n' "$RUNTIME_CONFIG_JSON" > /data/web-studio/runtime-config.js

# Ensure data directories exist
mkdir -p "$DYAD_DATA_DIR" "$DYAD_APPS_DIR"

# Start Xvfb (virtual framebuffer) for Electron
Xvfb :99 -screen 0 1024x768x24 -nolisten tcp &
XVFB_PID=$!
sleep 1

# Start nginx to serve the web studio and reverse-proxy the bridge
nginx

# Start the Electron app in headless mode.
# The binary name comes from package.json "name" field.
exec /opt/studio/dyad \
  --no-sandbox \
  --disable-gpu \
  --disable-software-rasterizer
