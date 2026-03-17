#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting Studio AI Builder (headless)"

# Inject runtime config into the web studio index.html
# This replaces the empty __RUNTIME_CONFIG__ with the actual bridge URL/token
BRIDGE_URL="${BRIDGE_URL:-http://localhost:4310}"
BRIDGE_TOKEN="${DYAD_WEB_BRIDGE_TOKEN:-}"

CONFIG_JS="window.__RUNTIME_CONFIG__ = { BRIDGE_URL: \"${BRIDGE_URL}\", BRIDGE_TOKEN: \"${BRIDGE_TOKEN}\" };"
sed -i "s|window.__RUNTIME_CONFIG__ = window.__RUNTIME_CONFIG__ || {};|${CONFIG_JS}|g" /data/web-studio/index.html

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
