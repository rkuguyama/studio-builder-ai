# Studio AI Builder — VM/SaaS Deployment Guide

This guide covers deploying Studio AI Builder as a web-accessible SaaS service on a Linux VM.

## Architecture Overview

```
Internet → nginx (TLS + static files) → Electron bridge server (:4310)
                                       ↘ Preview proxy (/preview/{appId}/)
```

- **nginx** terminates TLS, serves the Web Studio SPA, and reverse-proxies API/SSE/preview requests to the Electron bridge.
- **Electron** runs headless (with `xvfb`) and exposes the HTTP bridge on `localhost:4310`.
- **Web Studio** is a static Vite/React SPA served from nginx.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DYAD_HEADLESS` | `0` | Set to `1` to skip window creation |
| `DYAD_DATA_DIR` | Electron userData | Override path for SQLite DB and settings |
| `DYAD_APPS_DIR` | `~/dyad-apps` | Override path for user app projects |
| `DYAD_WEB_BRIDGE_TOKEN` | *(none)* | Static bearer token for bridge auth |
| `DYAD_WEB_BRIDGE_PORT` | `4310` | Bridge server port |
| `DYAD_WEB_BRIDGE_HOST` | `0.0.0.0` | Bridge server bind address |
| `DYAD_RATE_LIMIT_PER_MINUTE` | `200` | Max requests per IP per minute (0 to disable) |
| `BRIDGE_URL` | `http://localhost:4310` | Public URL for the bridge (injected into Web Studio at startup) |

## Quick Start with Docker Compose

```bash
# Clone and build
git clone <repo>
cd studio-ai-builder

# Set a secure token
export DYAD_WEB_BRIDGE_TOKEN=$(openssl rand -hex 32)
export BRIDGE_URL=https://studio.yourdomain.com

# Start
docker compose up -d
```

The app will be available at `http://localhost` (port 80).
Use an external reverse proxy / load balancer for HTTPS termination on 443.

## TLS with nginx (Bare Metal)

If deploying directly on a VM without Docker, use this nginx config with Let's Encrypt.

### 1. Install Certbot

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx
```

### 2. nginx Site Config

Create `/etc/nginx/sites-available/studio-ai-builder`:

```nginx
server {
    listen 80;
    server_name studio.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name studio.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/studio.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/studio.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Web Studio static files
    root /opt/studio/web-studio;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Bridge API
    location /invoke {
        proxy_pass http://127.0.0.1:4310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # SSE events
    location /events {
        proxy_pass http://127.0.0.1:4310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }

    # Channel listing
    location /channels {
        proxy_pass http://127.0.0.1:4310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health endpoint
    location /health {
        proxy_pass http://127.0.0.1:4310;
    }

    # Preview proxy with WebSocket support for HMR
    location /preview/ {
        proxy_pass http://127.0.0.1:4310;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }
}
```

### 3. Enable the Site and Obtain Certificates

```bash
sudo ln -s /etc/nginx/sites-available/studio-ai-builder /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d studio.yourdomain.com
sudo systemctl reload nginx
```

Certbot will automatically update the certificate files and set up auto-renewal.

## TLS with Caddy (Alternative)

[Caddy](https://caddyserver.com/) provides automatic TLS with zero configuration.

Create a `Caddyfile`:

```caddyfile
studio.yourdomain.com {
    root * /opt/studio/web-studio
    file_server
    try_files {path} /index.html

    reverse_proxy /invoke 127.0.0.1:4310
    reverse_proxy /channels 127.0.0.1:4310
    reverse_proxy /health 127.0.0.1:4310

    reverse_proxy /events 127.0.0.1:4310 {
        flush_interval -1
    }

    reverse_proxy /preview/* 127.0.0.1:4310
}
```

Start Caddy:

```bash
caddy run --config Caddyfile
```

Caddy will automatically provision and renew TLS certificates via Let's Encrypt.

## systemd Service (Bare Metal)

For running the Electron app as a system service:

Create `/etc/systemd/system/studio-ai-builder.service`:

```ini
[Unit]
Description=Studio AI Builder
After=network.target

[Service]
Type=simple
User=studio
Group=studio
Environment=DISPLAY=:99
Environment=DYAD_HEADLESS=1
Environment=DYAD_DATA_DIR=/data/db
Environment=DYAD_APPS_DIR=/data/apps
Environment=DYAD_WEB_BRIDGE_TOKEN=your-secure-token-here
Environment=DYAD_WEB_BRIDGE_PORT=4310
Environment=DYAD_WEB_BRIDGE_HOST=127.0.0.1
Environment=DYAD_RATE_LIMIT_PER_MINUTE=200

ExecStartPre=/usr/bin/Xvfb :99 -screen 0 1024x768x24 -nolisten tcp &
ExecStart=/opt/studio/dyad --no-sandbox --disable-gpu --disable-software-rasterizer
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable studio-ai-builder
sudo systemctl start studio-ai-builder
```

## Security Checklist

- [ ] Set a strong `DYAD_WEB_BRIDGE_TOKEN` (e.g. `openssl rand -hex 32`)
- [ ] Enable TLS (nginx + certbot, or Caddy)
- [ ] Restrict bridge to `127.0.0.1` (`DYAD_WEB_BRIDGE_HOST=127.0.0.1`) when behind a reverse proxy
- [ ] Configure rate limiting (`DYAD_RATE_LIMIT_PER_MINUTE`)
- [ ] Use dedicated data directories with proper permissions
- [ ] Set up firewall rules (only expose ports 80/443)
- [ ] Set up log rotation for Electron and nginx logs
