/**
 * Lightweight, process-local fixed-window rate limiting for Route Handlers.
 *
 * This is intentionally dependency-free: the application currently runs as a
 * single Node.js deployment. A horizontally scaled deployment must replace the
 * map with a shared store before treating these limits as global.
 */

const RATE_LIMIT_USER_HEADER = "x-agency-rate-limit-user";

export interface RateLimiterOptions {
  /** Maximum requests allowed during the window. */
  limit: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Override the default authenticated-user/IP identity strategy. */
  keyResolver?: (request: Request) => string;
}

interface Entry {
  count: number;
  resetAt: number;
}

export function getRateLimitKey(request: Request): string {
  // This header is removed and then set from the verified Supabase user in
  // proxy.ts. It must never be accepted directly from a browser request.
  const userId = request.headers.get(RATE_LIMIT_USER_HEADER);
  if (userId) return `user:${userId}`;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anonymous";
  return `ip:${ip}`;
}

export function rateLimitExceededResponse(retryAfter: number): Response {
  return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Retry-After": retryAfter.toString(),
    },
  });
}

export function createRateLimiter(options: RateLimiterOptions) {
  if (!Number.isInteger(options.limit) || options.limit < 1) {
    throw new Error("Rate limit must be a positive integer");
  }
  if (!Number.isFinite(options.windowMs) || options.windowMs < 1) {
    throw new Error("Rate-limit window must be greater than zero");
  }

  const entries = new Map<string, Entry>();
  const resolveKey = options.keyResolver ?? getRateLimitKey;
  let lastCleanupAt = 0;

  const cleanupExpiredEntries = (now: number) => {
    if (now - lastCleanupAt < 5 * 60_000) return;
    lastCleanupAt = now;
    for (const [key, entry] of entries) {
      if (entry.resetAt <= now) entries.delete(key);
    }
  };

  return {
    isAllowed(request: Request): boolean {
      const now = Date.now();
      cleanupExpiredEntries(now);
      const key = resolveKey(request);
      let entry = entries.get(key);
      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + options.windowMs };
        entries.set(key, entry);
      }
      if (entry.count >= options.limit) return false;
      entry.count += 1;
      return true;
    },
    getRetryAfter(request: Request): number {
      const entry = entries.get(resolveKey(request));
      return entry ? Math.max(0, Math.ceil((entry.resetAt - Date.now()) / 1000)) : 0;
    },
    // Kept for focused unit tests without exposing the map to application code.
    _debug: () => ({ entries }),
  };
}

/** Wrap a Route Handler with an in-memory fixed-window limiter. */
export function withRateLimit<TContext = unknown>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  options: RateLimiterOptions
) {
  const limiter = createRateLimiter(options);
  return async (request: Request, context: TContext): Promise<Response> => {
    if (!limiter.isAllowed(request)) {
      return rateLimitExceededResponse(limiter.getRetryAfter(request));
    }
    return handler(request, context);
  };
}
