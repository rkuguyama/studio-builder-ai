# --- Stage 1: Build the web studio static assets ---
FROM node:20-slim AS web-builder

WORKDIR /build
COPY package.json package-lock.json ./
COPY apps/web-studio/package.json apps/web-studio/
COPY packages/ packages/
RUN npm ci --ignore-scripts

COPY apps/web-studio/ apps/web-studio/
RUN npm --prefix apps/web-studio run build

# --- Stage 2: Build the Electron app for headless server use ---
FROM node:20-bookworm AS app-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    git \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run package -- --platform linux --arch x64 && \
    mv out/*-linux-x64 out/app

# --- Stage 3: Runtime image ---
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    xvfb \
    libgtk-3-0 \
    libnotify4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libdrm2 \
    libgbm1 \
    libx11-xcb1 \
    libxcb-dri3-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    nginx \
    git \
    curl \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user for running the app
RUN useradd --create-home --shell /bin/bash studio

# Prepare data directories
RUN mkdir -p /data/db /data/apps /data/web-studio && \
    chown -R studio:studio /data

# Copy the packaged Electron app
COPY --from=app-builder /build/out/app/ /opt/studio/
RUN chown -R studio:studio /opt/studio

# Copy web studio static build
COPY --from=web-builder /build/apps/web-studio/dist/ /data/web-studio/

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/sites-available/default

# Copy the entrypoint script
COPY deploy/entrypoint.sh /opt/studio/entrypoint.sh
RUN chmod +x /opt/studio/entrypoint.sh

ENV DYAD_HEADLESS=1 \
    DYAD_DATA_DIR=/data/db \
    DYAD_APPS_DIR=/data/apps \
    DYAD_WEB_BRIDGE_TOKEN=changeme \
    DYAD_WEB_BRIDGE_PORT=4310 \
    DYAD_WEB_BRIDGE_HOST=0.0.0.0 \
    DYAD_RATE_LIMIT_PER_MINUTE=200 \
    DISPLAY=:99

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:4310/health || exit 1

ENTRYPOINT ["/opt/studio/entrypoint.sh"]
