# Agency OS

Private internal agency/team management portal built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui primitives, Supabase Auth, PostgreSQL, Storage, and Realtime.

## Current status

This repository contains the authenticated agency-management workflows, admin/employee UI, Supabase data layer, private file lifecycle, realtime hooks, automation engine, analytics, scorecards, exports, audit screens, and production verification tooling. The implementation is locally buildable, but production readiness still requires live Supabase verification and deployment configuration.

- Next.js TypeScript App Router scaffold
- Supabase browser/server clients with cookie-based SSR session refresh
- Email/password login, employee registration, administrator login, and password recovery
- Protected admin and employee dashboards plus task, project, client, team, attendance, leave, reports, feed, documents, notifications, analytics, scorecards, and settings screens
- Supabase Auth callback with trusted role routing (`admin -> /admin`, `employee -> /dashboard`)
- Server-side role/profile guards and admin-only employee invitation endpoint
- One-time first-admin provisioning script and executable protected-route/RLS verification scripts
- Additive migrations for profile email synchronization, pending/active/suspended/inactive statuses, trusted employee-row creation, privilege-escalation protection, and last-admin protection
- Zod environment validation and `.env.example`
- shadcn/ui configuration plus a reusable Button primitive
- Initial PostgreSQL migration with requested entities, relationships, indexes, RLS, audit helper, and private Storage buckets
- Architecture, schema, API-contract, security, deployment, backup, observability, and PDF-workstream status documentation

## Local setup

```bash
npm install
Copy-Item .env.example .env.local
```

Fill `.env.local` with the real Supabase project URL and publishable key. The service-role key is server-only and is required only for admin invitation/provisioning scripts. Apply all migrations with the Supabase CLI or SQL editor, then configure Supabase Auth email settings and the `/auth/callback` and `/reset-password` redirect URLs. Public registration always creates an employee account; only the provisioning script can create the first administrator.

```bash
npm run typecheck
npm run lint
npm run build
npm run dev
```

Provision the first administrator once, from a trusted operator machine, with `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_FULL_NAME` set in `.env.local`:

```bash
npm run provision:first-admin
```

An administrator can invite employees through `POST /api/admin/employees`. The endpoint accepts validated employee data but always provisions the `employee` role; there is no public admin signup or client-controlled role promotion.

Verification scripts require dedicated test accounts in `.env.local`:

```bash
npm run verify:routes
npm run verify:rls
```

Never place a Supabase service-role key in `.env.example`, browser code, or any `NEXT_PUBLIC_*` variable. The migration enables RLS and uses private Storage buckets by default.

Read [architecture.md](./architecture.md), [database-schema.md](./database-schema.md), [security.md](./security.md), [docs/deployment.md](./docs/deployment.md), and [docs/pdf-batch-status.md](./docs/pdf-batch-status.md) before publishing a deployment.
