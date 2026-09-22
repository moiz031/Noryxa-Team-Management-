# API Rate Limiting – Policy & Implementation

## Overview

This document describes the rate‑limiting policy applied across the Agency Team Management API.
Rate limiting is implemented as a simple **in‑memory token‑counter** per Node.js process using
`src/lib/api/rate-limit.ts`.

## Architecture

### Implementation

- **File:** [`src/lib/api/rate-limit.ts`](../src/lib/api/rate-limit.ts)
- **Mechanism:** In-memory `Map<string, Entry>` where `Entry = { count, resetAt }`.
- **Window type:** Fixed window (counter resets at `resetAt`).
- **Cleanup:** `setInterval` every 5 minutes purges expired entries to prevent memory leaks.

### Identity Key Strategy

| Route Type | Key Source | Fallback |
|------------|-----------|---------|
| Authenticated routes | User ID (from session) | `x-forwarded-for` header → `'anonymous'` |
| Public / IP-based routes | `x-forwarded-for` header | `'anonymous'` |

> **Note:** In local development, the fallback may resolve to `::1` (IPv6 loopback). This is expected
> behaviour and does not affect production (where a reverse proxy sets `x-forwarded-for`).

### Single‑Process Limitation

This implementation is **not distributed**. Each Node.js server instance maintains its own counters.
In a multi-instance deployment (e.g., multiple Vercel edge workers), each instance tracks separately.

**Migration path to distributed store:** Replace the `Map` in `rate-limit.ts` with a Redis client call
(e.g., `INCR` + `EXPIRE`). The public API (`createRateLimiter`, `withRateLimit`) remains the same.

## Integration Points

### `apiHandler` wrapper (`src/lib/api/api-wrapper.ts`)

Pass `rateLimit` in the options object:

```ts
export const POST = apiHandler({
  auth: 'user',
  rateLimit: { limit: 15, windowMs: 60_000 },
  handler: async (req) => { ... },
});
```

### `withRateLimit` helper

For routes that do not use `apiHandler`:

```ts
export const POST = withRateLimit(myHandler, {
  limit: 20,
  windowMs: 60_000,
  keyResolver: (req) => req.headers.get('x-forwarded-for') ?? 'anonymous',
});
```

## Rate Limit Inventory

See [`api-rate-limit-inventory.md`](./api-rate-limit-inventory.md) for the full per‑endpoint table.

## Error Response

When a limit is exceeded:

```json
HTTP 429 Too Many Requests
Retry-After: 42

{
  "error": "Too many requests. Please try again later."
}
```

The `Retry-After` header contains the number of **seconds** remaining until the window resets.
