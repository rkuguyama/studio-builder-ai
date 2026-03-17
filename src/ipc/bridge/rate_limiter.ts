import type { IncomingMessage, ServerResponse } from "node:http";
import log from "electron-log";

const logger = log.scope("rate_limiter");

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

export interface RateLimiterOptions {
  /** Max requests per window. Defaults to 100. */
  maxRequests?: number;
  /** Window size in milliseconds. Defaults to 60_000 (1 minute). */
  windowMs?: number;
  /** Whether rate limiting is enabled. Defaults to true. */
  enabled?: boolean;
}

/**
 * Token-bucket rate limiter keyed by client IP.
 * Each IP gets `maxRequests` tokens that refill at a rate of
 * `maxRequests / windowMs` tokens per millisecond.
 */
export class RateLimiter {
  private buckets = new Map<string, RateLimitEntry>();
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private readonly enabled: boolean;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(options: RateLimiterOptions = {}) {
    this.maxTokens = options.maxRequests ?? 100;
    const windowMs = options.windowMs ?? 60_000;
    this.refillRate = this.maxTokens / windowMs;
    this.enabled = options.enabled ?? true;

    // Periodically clean up stale entries (every 5 minutes)
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60_000);
  }

  private getClientIp(request: IncomingMessage): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0].trim();
    }
    return request.socket.remoteAddress ?? "unknown";
  }

  private refill(entry: RateLimitEntry): void {
    const now = Date.now();
    const elapsed = now - entry.lastRefill;
    entry.tokens = Math.min(
      this.maxTokens,
      entry.tokens + elapsed * this.refillRate,
    );
    entry.lastRefill = now;
  }

  /**
   * Returns true if the request is allowed, false if rate-limited.
   * When rate-limited, writes a 429 response and returns false.
   */
  check(request: IncomingMessage, response: ServerResponse): boolean {
    if (!this.enabled) return true;

    const ip = this.getClientIp(request);
    let entry = this.buckets.get(ip);

    if (!entry) {
      entry = { tokens: this.maxTokens, lastRefill: Date.now() };
      this.buckets.set(ip, entry);
    }

    this.refill(entry);

    if (entry.tokens < 1) {
      logger.warn(`Rate limited: ${ip}`);
      response.writeHead(429, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          ok: false,
          error: "Too many requests. Please try again later.",
        }),
      );
      return false;
    }

    entry.tokens -= 1;
    return true;
  }

  private cleanup(): void {
    const staleThreshold = Date.now() - 10 * 60_000;
    for (const [ip, entry] of this.buckets) {
      if (entry.lastRefill < staleThreshold) {
        this.buckets.delete(ip);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.buckets.clear();
  }
}
