# Production deployment checklist

The application is a Next.js App Router deployment backed by Supabase. A deployment is only ready after the local checks and the live Supabase checks below have evidence.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

The service-role and cron values are server-only. They must not use a `NEXT_PUBLIC_` prefix or be committed to the repository.

## Automation schedule

`vercel.json` schedules `GET /api/cron/automation` hourly. The endpoint accepts only a matching `Authorization: Bearer <CRON_SECRET>` value (or the equivalent trusted `x-cron-secret` header), runs the idempotent automation engine, and returns a generic error on failure. Configure the same `CRON_SECRET` in the Vercel project before enabling the schedule.

The automation engine's database claim keys prevent duplicate hourly executions. Confirm the deployed plan supports the configured Vercel Cron frequency before production use.

## Verification gates

```text
npm run lint
npm run typecheck
npm test -- --detectOpenHandles --forceExit
npm run build
npm run verify:routes
npm run verify:rls
npm run test:integration:live
npm run verify:load
node --env-file=.env.local scripts/verify-full-file-management.mjs
node --env-file=.env.local scripts/verify-realtime-e2e.mjs
node --env-file=.env.local scripts/verify-backup-readiness.mjs
```

The live checks require a reachable Supabase project and dedicated verification accounts. On 2026-09-22 the live migration parity, RLS, integration (18/18), Storage (10/10), Realtime, full-system, analytics, scorecard, automation, backup-readiness (6/6), and bounded load (100/100) checks passed.

Before publishing, apply all migrations, configure Supabase Auth redirect URLs, set the required Vercel environment variables, and perform an authenticated smoke test for login, employee/admin role routing, task mutation, leave approval, notification read-state, private file download, and realtime delivery.
