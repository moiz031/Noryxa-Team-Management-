# API Rate Limit Inventory

This table documents every rate‑limited endpoint in the application.

| Endpoint | Method | Limit | Window (ms) | Identity Key | Rationale | Implementation |
|----------|--------|------:|------------:|--------------|-----------|----------------|
| `/api/notifications` | POST | 20 | 60 000 | IP (x-forwarded-for) | Prevent notification flood | `withRateLimit` in route |
| `/api/export` | POST | 5 | 60 000 | IP (x-forwarded-for) | Export abuse / DoS | `withRateLimit` in route |
| `/api/feed/posts` | POST | 15 | 60 000 | IP (x-forwarded-for) | Posting spam | `withRateLimit` in route |
| `/api/feed/posts/[id]/comments` | POST | 30 | 60 000 | IP (x-forwarded-for) | Comment spam | `withRateLimit` in route |
| `/api/feed/reactions` | POST | 60 | 60 000 | IP (x-forwarded-for) | Reaction abuse | `withRateLimit` in route |
| `/api/profile/avatar` | POST | 10 | 60 000 | IP (x-forwarded-for) | Upload abuse | `withRateLimit` in route |
| `/api/admin/automation` | POST | 10 | 60 000 | IP (x-forwarded-for) | Automation trigger abuse | `withRateLimit` in route |

## Notes

- **Identity source:** All entries currently use `x-forwarded-for` header, with `'anonymous'` fallback.
  In a production environment behind a load balancer, `x-forwarded-for` reliably identifies the client.
- **Window type:** Fixed window (counter resets after `windowMs` milliseconds from the first request).
- **Auth-aware limiting:** For endpoints that require authentication, a future improvement would resolve
  the identity key from the authenticated user ID to avoid penalising users who share a NAT IP.
- **Not covered (low risk or handled elsewhere):** GET endpoints, admin read endpoints, profile reads.

## Adding a New Rate-Limited Endpoint

1. Import `withRateLimit` from `@/lib/api/rate-limit`.
2. Wrap the handler: `export const POST = withRateLimit(handler, { limit, windowMs, keyResolver? })`.
3. Add an entry to this inventory table.
4. Add a test case to `src/tests/api/rate-limit.test.ts`.
