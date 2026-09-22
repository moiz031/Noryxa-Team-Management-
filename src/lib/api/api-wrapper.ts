import { NextResponse } from 'next/server';

import { ZodSchema } from 'zod';
import { requireAuth, requireUser, requireAdmin } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createRateLimiter, rateLimitExceededResponse, RateLimiterOptions } from '@/lib/api/rate-limit';
import { logAuditEvent } from '@/lib/audit/logger';
import { log } from '@/lib/observability/logger';
import { randomUUID } from 'crypto';

/**
 * Options for the API wrapper.
 */
export interface ApiHandlerContext {
  validated?: unknown;
  context?: unknown;
}

export interface ApiHandlerOptions {
  /**
   * The core handler that receives the request (and optionally parsed params) and returns a Response.
   * It should throw on error – the wrapper will catch and map it.
   */
  handler: (request: Request, context: ApiHandlerContext) => Promise<Response>;
  /**
   * Authentication requirement. Defaults to "auth" (any logged‑in user).
   * Use "admin" for admin‑only routes, "user" (requireUser) for routes that need the full user object.
   */
  auth?: 'auth' | 'admin' | 'user';
  /**
   * Optional rate limiting configuration. If provided, requests exceeding the limit will receive a 429 response.
   */
  rateLimit?: RateLimiterOptions;
  /**
   * Optional Zod schema to validate the request body (for POST/PATCH) or query parameters.
   * If provided, the parsed data will be passed as `context.validated` to the handler.
   */
  validationSchema?: ZodSchema<unknown>;
  /**
   * Optional custom error mapper. Receives the caught error and should return an object
   * with `status` (HTTP status code) and `body` (JSON payload). If omitted, a default mapping
   * based on error message/content is applied.
   */
  errorMapper?: (error: unknown) => { status: number; body: Record<string, unknown> };
  /**
   * Optional activity‑log configuration. When supplied, the wrapper will automatically insert
   * a row into `activity_logs` after a successful request.
   *
   * - `actionType`: string used for `action_type` column.
   * - `entityType`: optional entity type (e.g., "announcement").
   * - `entityIdGetter`: function that receives the handler's response JSON and returns the
   *   entity id to store, or `null`.
   */
  activityLog?: {
    actionType: string;
    entityType?: string;
    entityIdGetter?: (responseJson: unknown) => string | null;
    // if true, the wrapper will *not* log if the route already performed its own insert.
    skipIfAlreadyLogged?: boolean;
  };
}

/**
 * Default error mapper – converts known Supabase/Postgres messages into sanitized responses.
 */
function defaultErrorMapper(error: unknown): { status: number; body: Record<string, unknown> } {
  const message = error instanceof Error ? error.message : String(error);
  // Common Supabase error codes
  if (message.includes('PGRST116')) {
    // Row not found – treat as 404
    return { status: 404, body: { error: 'Resource not found' } };
  }
  if (message.toLowerCase().includes('duplicate')) {
    return { status: 409, body: { error: 'Duplicate resource' } };
  }
  if (message.toLowerCase().includes('unauthenticated') || message.toLowerCase().includes('authentication required')) {
    return { status: 401, body: { error: 'Unauthenticated' } };
  }
  if (message.toLowerCase().includes('authorization') || message.toLowerCase().includes('admin')) {
    return { status: 403, body: { error: 'Forbidden' } };
  }
  // Fallback – internal server error without leaking details
  return { status: 500, body: { error: 'Internal server error' } };
}

/**
 * Centralised API handler wrapper.
 *
 * Usage example (inside a route file):
 * ```ts
 * export const GET = apiHandler({
 *   auth: 'admin',
 *   handler: async (req) => {
 *     const data = await getSomething();
 *     return NextResponse.json({ data });
 *   },
 *   activityLog: { actionType: 'something.fetched', entityType: 'something' },
 * });
 * ```
 */
export function apiHandler(options: ApiHandlerOptions) {
  const {
    handler,
    auth = 'auth',
    validationSchema,
    errorMapper,
    activityLog,
    rateLimit,
  } = options;

  // Initialize rate limiter if configuration is provided
  const limiter = rateLimit ? createRateLimiter(rateLimit) : null;

  // Return a function suitable for Next.js route export (GET, POST, etc.)
  return async (request: Request, context?: unknown): Promise<Response> => {
    const requestId = randomUUID();
    try {
      // ----- Rate limiting (executed before authentication) -----
      if (limiter) {
        if (!limiter.isAllowed(request)) {
          const retryAfter = limiter.getRetryAfter(request);
          return rateLimitExceededResponse(retryAfter);
        }
      }

      // ----- Request tracing -----
      if (process.env.ENABLE_OBSERVABILITY === 'true') {
        log.info({ requestId, method: request.method, url: request.url }, 'API request start');
      }

      // ----- Authentication -----
      if (auth === 'admin') {
        await requireAdmin();
      } else if (auth === 'user') {
        await requireUser();
      } else {
        await requireAuth();
      }

      // ----- Validation -----
      let validated: unknown = undefined;
      if (validationSchema) {
        const method = request.method?.toUpperCase();
        if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
          const json = await request.json();
          const parse = validationSchema.safeParse(json);
          if (!parse.success) {
            return NextResponse.json({ error: 'Invalid request payload', details: parse.error.issues }, { status: 400 });
          }
          validated = parse.data;
        } else {
          // For GET/DELETE we may validate query params if needed – caller can pass a custom schema that expects a plain object.
          const url = new URL(request.url);
          const paramsObj: Record<string, string> = {};
          url.searchParams.forEach((value, key) => {
            paramsObj[key] = value;
          });
          const parse = validationSchema.safeParse(paramsObj);
          if (!parse.success) {
            return NextResponse.json({ error: 'Invalid query parameters', details: parse.error.issues }, { status: 400 });
          }
          validated = parse.data;
        }
      }

      // ----- Core handler -----
      const response = await handler(request, { validated, context });

      // ----- Automatic activity logging (if configured) -----
      if (activityLog && !activityLog.skipIfAlreadyLogged) {
        try {
          const supabase = await createSupabaseServerClient();
          const user = (await supabase.auth.getUser()).data.user;
          let entityId: string | null = null;
          try {
            const jsonBody = await response.clone().json();
            entityId = activityLog.entityIdGetter ? activityLog.entityIdGetter(jsonBody) : null;
          } catch {
            // Response was not JSON or already consumed
          }

          await logAuditEvent({
            actorId: user?.id || null,
            event: activityLog.actionType,
            entityType: activityLog.entityType || null,
            entityId: entityId,
            metadata: {}, // Bounded empty metadata prevents unbounded response leakage/PII dumps
            source: 'api',
            request: request,
          });
        } catch (logErr) {
          // Logging failure must not affect the original response
          if (process.env.ENABLE_OBSERVABILITY === 'true') {
        log.error({ requestId, error: logErr }, 'Activity log insertion failed');
      }
        }
      }

      return response;
    } catch (err) {
      const mapper = errorMapper || defaultErrorMapper;
      if (process.env.ENABLE_OBSERVABILITY === 'true') {
        log.error({ requestId, error: err }, 'API handler error');
      }
      const { status, body } = mapper(err);
      return NextResponse.json(body, { status });
    }
  };
}
