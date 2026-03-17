# Web Studio + VM Bridge

This project now includes a web frontend at `apps/web-studio` and an HTTP bridge in the desktop runtime so the same app/agent workflows can be driven remotely.

## 1) Start runtime in VM with bridge enabled

Set these environment variables when starting the main app process:

- `DYAD_ENABLE_WEB_BRIDGE=1`
- `DYAD_WEB_BRIDGE_PORT=4310` (optional, default `4310`)
- `DYAD_WEB_BRIDGE_HOST=0.0.0.0` (optional, default `0.0.0.0`)
- `DYAD_WEB_BRIDGE_TOKEN=<strong-secret>` (optional but recommended)

Bridge endpoints:

- `GET /health`
- `GET /channels`
- `POST /invoke` with body:
  - `channel: string`
  - `input: unknown` (optional)

## 2) Start web frontend

From repo root:

- `npm run web:dev`

Configure frontend with:

- `VITE_DYAD_BRIDGE_URL` (for example `http://vm-host:4310`)
- `VITE_DYAD_BRIDGE_TOKEN` (if bridge auth is enabled)

## Notes

- The bridge reuses existing IPC channel handlers (no business logic duplication).
- Streaming/event channels still rely on Electron event wiring; the current web frontend uses invoke-style channels.
- For production SaaS use, place this bridge behind API gateway auth/TLS and restrict network access.
