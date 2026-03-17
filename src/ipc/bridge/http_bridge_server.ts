import http, { type IncomingMessage, type ServerResponse } from "node:http";
import log from "electron-log";
import {
  invokeRegisteredChannel,
  listRegisteredInvokeChannels,
} from "./invoke_registry";
import { eventBus } from "./event_bus";
import {
  parsePreviewPath,
  handlePreviewRequest,
  handlePreviewUpgrade,
} from "./preview_proxy";
import { handleExportRequest, parseExportPath } from "./export_zip";
import { RateLimiter } from "./rate_limiter";

const logger = log.scope("http_bridge_server");

export interface BridgeServerOptions {
  port: number;
  host?: string;
  authToken?: string;
  /** Max requests per IP per minute. Defaults to 200. Set 0 to disable. */
  rateLimitPerMinute?: number;
}

function setCorsHeaders(response: ServerResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function isAuthorized(request: IncomingMessage, authToken?: string): boolean {
  if (!authToken) return true;

  const authHeader = request.headers.authorization;
  if (authHeader) return authHeader === `Bearer ${authToken}`;

  // SSE (EventSource) can't set headers; allow token as query param
  const url = new URL(request.url ?? "/", "http://localhost");
  const queryToken = url.searchParams.get("token");
  if (queryToken) return queryToken === authToken;

  return false;
}

async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  if (!body) return {};
  return JSON.parse(body);
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
) {
  setCorsHeaders(response);
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
}

function handleSseConnection(response: ServerResponse): void {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  response.write(":connected\n\n");
  eventBus.addClient(response);
}

export function startHttpBridgeServer(options: BridgeServerOptions) {
  const rateLimitMax = options.rateLimitPerMinute ?? Number(process.env.DYAD_RATE_LIMIT_PER_MINUTE ?? "200");
  const rateLimiter = new RateLimiter({
    maxRequests: rateLimitMax,
    windowMs: 60_000,
    enabled: rateLimitMax > 0,
  });

  const server = http.createServer(async (request, response) => {
    try {
      setCorsHeaders(response);
      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      const url = request.url ?? "/";

      // Health check bypasses rate limiting
      if (url === "/health" && request.method === "GET") {
        sendJson(response, 200, { ok: true, service: "studio-ai-bridge" });
        return;
      }

      if (!rateLimiter.check(request, response)) return;

      // Preview proxy — serve user-generated app previews in a sandboxed iframe.
      // Auth is skipped because sub-resource requests (scripts, CSS, images,
      // ES module imports) from within the iframe don't carry the auth token.
      // The initial iframe URL is only known to authenticated web-studio users.
      const preview = parsePreviewPath(url);
      if (preview) {
        handlePreviewRequest(request, response, preview.appId, preview.subPath);
        return;
      }

      // Zip export — stream the app folder as a .zip download
      const exportInfo = parseExportPath(url);
      if (exportInfo) {
        if (!isAuthorized(request, options.authToken)) {
          sendJson(response, 401, { ok: false, error: "Unauthorized" });
          return;
        }
        await handleExportRequest(response, exportInfo.appId);
        return;
      }

      if (!isAuthorized(request, options.authToken)) {
        sendJson(response, 401, { ok: false, error: "Unauthorized" });
        return;
      }

      // SSE event stream
      const urlPath = new URL(url, "http://localhost").pathname;
      if (urlPath === "/events" && request.method === "GET") {
        handleSseConnection(response);
        return;
      }

      if (urlPath === "/channels" && request.method === "GET") {
        sendJson(response, 200, {
          ok: true,
          channels: listRegisteredInvokeChannels(),
        });
        return;
      }

      if (urlPath === "/invoke" && request.method === "POST") {
        const payload = (await parseJsonBody(request)) as {
          channel?: string;
          input?: unknown;
        };
        if (!payload.channel) {
          sendJson(response, 400, { ok: false, error: "channel is required" });
          return;
        }

        const result = await invokeRegisteredChannel({
          channel: payload.channel,
          input: payload.input,
        });
        sendJson(response, 200, { ok: true, result });
        return;
      }

      sendJson(response, 404, { ok: false, error: "Not found" });
    } catch (error) {
      logger.error("Bridge request failed", error);
      const message = error instanceof Error ? error.message : String(error);
      sendJson(response, 500, { ok: false, error: message });
    }
  });

  // WebSocket upgrade for preview HMR — auth is skipped for the same
  // reason as HTTP preview: the iframe's sub-resource requests don't carry tokens.
  server.on("upgrade", (request, socket, head) => {
    const preview = parsePreviewPath(request.url ?? "/");
    if (!preview) {
      socket.destroy();
      return;
    }

    handlePreviewUpgrade(request, socket, head, preview.appId);
  });

  server.listen(options.port, options.host ?? "0.0.0.0", () => {
    logger.info(
      `HTTP bridge listening on ${options.host ?? "0.0.0.0"}:${options.port}`,
    );
  });

  return server;
}
