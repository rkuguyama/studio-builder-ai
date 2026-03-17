import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import log from "electron-log";
import { runningApps } from "../utils/process_manager";
import { isProxyWorkerDead, markProxyWorkerDead } from "./proxy_worker_state";

const logger = log.scope("preview_proxy");

interface UpstreamTarget {
  hostname: string;
  port: number;
}

function urlToTarget(raw: string): UpstreamTarget | null {
  try {
    const url = new URL(raw);
    return { hostname: url.hostname, port: Number(url.port) || 80 };
  } catch {
    return null;
  }
}

const IS_HEADLESS =
  process.env.DYAD_HEADLESS === "1" ||
  process.env.DYAD_HEADLESS === "true";

/**
 * Rewrite absolute paths in HTML so that sub-resources load through the
 * preview proxy (/preview/{appId}/...) instead of the server root.
 *
 * Without this, Vite's `<script src="/src/main.tsx">` resolves to
 * `http://server/src/main.tsx` which nginx serves as the SPA, producing
 * a blank iframe.
 */
function rewriteHtmlPaths(html: string, appId: number): string {
  const prefix = `/preview/${appId}`;

  // src="/...", href="/...", action="/...", poster="/...", data="/..."
  // Negative lookahead avoids double-rewriting and protocol-relative URLs.
  let result = html.replace(
    /((?:src|href|action|poster|data)\s*=\s*)(["'])(\/(?!\/|preview\/)[^"']*)\2/gi,
    (_m, attr: string, q: string, p: string) => `${attr}${q}${prefix}${p}${q}`,
  );

  // ES module: from "/..."
  result = result.replace(
    /(from\s+)(["'])(\/(?!\/|preview\/)[^"']*)\2/g,
    (_m, kw: string, q: string, p: string) => `${kw}${q}${prefix}${p}${q}`,
  );

  // Dynamic import: import("/...")
  result = result.replace(
    /(import\s*\(\s*)(["'])(\/(?!\/|preview\/)[^"']*)\2/g,
    (_m, kw: string, q: string, p: string) => `${kw}${q}${prefix}${p}${q}`,
  );

  return result;
}

/**
 * Resolve the upstream target for a running app.
 *
 * In headless/SaaS mode the proxy worker's script injection (desktop shim,
 * component selector, visual editor, etc.) breaks web-browser iframes, so
 * we skip the proxy worker entirely and serve from the original dev server.
 *
 * In desktop mode, prefers the proxy worker (proxyUrl) but falls back to
 * originalUrl if the worker has been flagged as dead.
 */
function resolveTarget(appId: number): UpstreamTarget | null {
  const appInfo = runningApps.get(appId);
  if (!appInfo) return null;

  const skipProxyWorker =
    IS_HEADLESS || isProxyWorkerDead(appId);

  if (appInfo.proxyUrl && !skipProxyWorker) {
    const t = urlToTarget(appInfo.proxyUrl);
    if (t) return t;
    logger.error(`Invalid proxyUrl for app ${appId}: ${appInfo.proxyUrl}`);
  }

  if (appInfo.originalUrl) {
    const t = urlToTarget(appInfo.originalUrl);
    if (t) return t;
    logger.error(
      `Invalid originalUrl for app ${appId}: ${appInfo.originalUrl}`,
    );
  }

  return null;
}

/**
 * Parse preview paths like "/preview/42/" or "/preview/42/index.html"
 * Returns { appId, subPath } or null if the path doesn't match.
 */
export function parsePreviewPath(
  url: string,
): { appId: number; subPath: string } | null {
  const match = /^\/preview\/(\d+)(\/.*)?$/.exec(url);
  if (!match) return null;
  const appId = Number(match[1]);
  const subPath = match[2] || "/";
  return { appId, subPath };
}

function proxyHttpTo(
  target: UpstreamTarget,
  req: IncomingMessage,
  res: ServerResponse,
  appId: number,
  subPath: string,
): void {
  const reqHeaders: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: `${target.hostname}:${target.port}`,
  };

  // In headless mode we may rewrite HTML, so request uncompressed content.
  if (IS_HEADLESS) {
    delete reqHeaders["accept-encoding"];
    delete reqHeaders["if-none-match"];
  }

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: subPath,
      method: req.method,
      headers: reqHeaders,
    },
    (proxyRes) => {
      const location = proxyRes.headers.location;
      if (location && location.startsWith("/")) {
        proxyRes.headers.location = `/preview/${appId}${location}`;
      }

      const ct = proxyRes.headers["content-type"] ?? "";
      const isHtml =
        typeof ct === "string" && ct.toLowerCase().includes("text/html");

      if (IS_HEADLESS && isHtml) {
        const chunks: Buffer[] = [];
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          const original = Buffer.concat(chunks).toString("utf-8");
          const rewritten = rewriteHtmlPaths(original, appId);
          const buf = Buffer.from(rewritten, "utf-8");

          const hdrs = { ...proxyRes.headers };
          hdrs["content-length"] = String(Buffer.byteLength(buf));
          delete hdrs["content-encoding"];
          delete hdrs["etag"];

          res.writeHead(proxyRes.statusCode ?? 200, hdrs);
          res.end(buf);
        });
        return;
      }

      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", (err) => {
    logger.error(`Preview proxy error for app ${appId}:`, err.message);

    const appInfo = runningApps.get(appId);
    if (
      appInfo?.originalUrl &&
      appInfo.proxyUrl &&
      target.port !== (urlToTarget(appInfo.originalUrl)?.port ?? -1)
    ) {
      markProxyWorkerDead(appId);
      logger.info(
        `Proxy worker for app ${appId} flagged as dead — switching to originalUrl for all future requests`,
      );

      const fallback = urlToTarget(appInfo.originalUrl);
      if (fallback && !res.headersSent) {
        proxyHttpTo(fallback, req, res, appId, subPath);
        return;
      }
    }

    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Preview upstream error" }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

export function handlePreviewRequest(
  req: IncomingMessage,
  res: ServerResponse,
  appId: number,
  subPath: string,
): void {
  const target = resolveTarget(appId);
  if (!target) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: false,
        error: `App ${appId} is not running or has no preview URL`,
      }),
    );
    return;
  }

  proxyHttpTo(target, req, res, appId, subPath);
}

function upgradeToTarget(
  target: UpstreamTarget,
  req: IncomingMessage,
  clientSocket: net.Socket,
  head: Buffer,
  appId: number,
  subPath: string,
): void {
  const upstreamSocket = net.connect(
    { host: target.hostname, port: target.port },
    () => {
      const reqLine = `${req.method ?? "GET"} ${subPath} HTTP/1.1\r\n`;
      const headers = Object.entries({
        ...req.headers,
        host: `${target.hostname}:${target.port}`,
      })
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join("\r\n");

      upstreamSocket.write(`${reqLine}${headers}\r\n\r\n`);
      if (head.length > 0) {
        upstreamSocket.write(head);
      }

      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    },
  );

  upstreamSocket.on("error", (err) => {
    logger.error(
      `Preview WebSocket proxy error for app ${appId}:`,
      err.message,
    );

    const appInfo = runningApps.get(appId);
    if (
      appInfo?.originalUrl &&
      appInfo.proxyUrl &&
      target.port !== (urlToTarget(appInfo.originalUrl)?.port ?? -1)
    ) {
      markProxyWorkerDead(appId);

      const fallback = urlToTarget(appInfo.originalUrl);
      if (fallback && !clientSocket.destroyed) {
        logger.info(
          `Retrying WebSocket for app ${appId} via originalUrl: ${appInfo.originalUrl}`,
        );
        upgradeToTarget(fallback, req, clientSocket, head, appId, subPath);
        return;
      }
    }

    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    upstreamSocket.destroy();
  });
}

export function handlePreviewUpgrade(
  req: IncomingMessage,
  clientSocket: net.Socket,
  head: Buffer,
  appId: number,
): void {
  const target = resolveTarget(appId);
  if (!target) {
    clientSocket.destroy();
    return;
  }

  const parsed = parsePreviewPath(req.url ?? "/");
  const subPath = parsed?.subPath ?? "/";

  upgradeToTarget(target, req, clientSocket, head, appId, subPath);
}
