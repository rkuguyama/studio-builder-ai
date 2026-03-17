import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import log from "electron-log";
import { runningApps } from "../utils/process_manager";

const logger = log.scope("preview_proxy");

interface UpstreamTarget {
  hostname: string;
  port: number;
}

function resolveTarget(appId: number): UpstreamTarget | null {
  const appInfo = runningApps.get(appId);
  if (!appInfo?.proxyUrl) return null;

  try {
    const url = new URL(appInfo.proxyUrl);
    return {
      hostname: url.hostname,
      port: Number(url.port) || 80,
    };
  } catch {
    logger.error(`Invalid proxyUrl for app ${appId}: ${appInfo.proxyUrl}`);
    return null;
  }
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

  const proxyReq = http.request(
    {
      hostname: target.hostname,
      port: target.port,
      path: subPath,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${target.hostname}:${target.port}`,
      },
    },
    (proxyRes) => {
      // Rewrite Location headers so redirects stay within the preview gateway
      const location = proxyRes.headers.location;
      if (location && location.startsWith("/")) {
        proxyRes.headers.location = `/preview/${appId}${location}`;
      }

      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", (err) => {
    logger.error(`Preview proxy error for app ${appId}:`, err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Preview upstream error" }));
    }
  });

  req.pipe(proxyReq, { end: true });
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
    clientSocket.destroy();
  });

  clientSocket.on("error", () => {
    upstreamSocket.destroy();
  });
}
