# Architecture

## Folder structure

```text
src/
  app/
    auth/callback/route.ts       # Supabase PKCE callback and role routing
    auth/signout/route.ts        # server-side logout
    api/admin/employees/route.ts # admin-only invite/onboarding endpoint
    login/page.tsx               # client-only email OTP form
    dashboard/page.tsx           # protected employee landing shell
    layout.tsx
    globals.css
  components/
    ui/                          # shadcn/ui primitives
    layout/                      # future portal navigation and shells
    admin/                       # admin dashboard components
    employee/                    # employee workspace components
  lib/
    auth/context.ts              # trusted user/profile/role lookup
    auth/roles.ts                # server-side user/admin/employee guards
    auth/validation.ts           # Zod onboarding schema
    supabase/admin.ts            # server-only service-role client
    supabase/browser.ts          # browser client, publishable key only
    supabase/server.ts           # Server Component/Action client
    supabase/middleware.ts       # cookie-aware session helper
  proxy.ts                       # session refresh and route gate (Next 16)
    env.ts                       # Zod-validated public environment
    utils.ts
scripts/
  provision-first-admin.mjs     # one-time trusted provisioning
  verify-rls.mjs                # live RLS/role separation checks
  verify-protected-routes.mjs   # unauthenticated route checks
supabase/
  migrations/                    # versioned PostgreSQL schema and policies
```

## Route structure

Public routes are `/` and `/login`. `/auth/callback` exchanges the Supabase PKCE code. Protected employee routes will live at `/dashboard`, `/tasks`, `/projects`, `/reports`, `/attendance`, `/leave`, `/announcements`, and `/documents`. Admin routes are grouped under `/admin`, including `/admin/teams`, `/admin/teams/[id]`, `/admin/schedules`, `/admin/holidays`, `/admin/clients`, and `/admin/clients/[id]` for Batch 2 operations.

The route tree is deliberately separate from the authorization decision. The Next 16 proxy handles session presence; server layouts, server actions, and RLS enforce role and record scope.

## Component architecture

Use Server Components for initial data reads and page composition. Use Client Components only for forms, optimistic interaction, Realtime subscriptions, filters, and browser APIs. Keep reusable visual primitives in `components/ui`; domain components should own presentation and receive typed data rather than querying Supabase directly.

Use React Hook Form + Zod for complex forms. Mutations should be server actions or route handlers that validate input, perform an authorized Supabase query, and call `log_activity()` for a meaningful business event.

## Authentication and authorization

Supabase Auth is the identity provider. The `auth.users.id` is the `profiles.id`; a database trigger creates a least-privileged employee profile and pending employee row for a new user. Admin promotion is available only through the one-time service-role provisioning script and cannot be requested through signup metadata or onboarding input.

`proxy.ts` refreshes the Auth cookie and redirects unauthenticated requests. `requireEmployee()` protects `/dashboard`; `requireAdmin()` protects `/admin` and the onboarding endpoint. The callback reads the database role after exchanging the PKCE code and routes admins to `/admin` and employees to `/dashboard`. UI hiding is only a usability layer; RLS remains authoritative.

## Supabase integration and server/client separation

`@supabase/ssr` is used for browser and server clients. The browser client receives only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server Components use the cookie-aware server client. A future server-only admin client may use a service-role secret only inside server actions/route handlers and must never be imported into client modules.

The onboarding endpoint validates all fields with Zod, rejects duplicate Auth email, sends a Supabase Auth invite, updates the trigger-created profile, and updates its pending employee row. Its accepted role is intentionally the literal `employee`; admin provisioning is a separate trusted operation.

## Realtime strategy

Enable Realtime for `activity_logs`, `notifications`, `tasks`, `announcements`, `attendance`, and `daily_reports` only. Admin pages subscribe to organization-level activity and counter changes; employee pages subscribe only to their own tasks, notifications, reports, and attendance. The client should invalidate/refetch the relevant server query after a change rather than treating an untrusted event payload as authorization.

Use filtered channels where possible, keep subscriptions in Client Components with cleanup, and debounce counter refreshes. Server-side RLS still applies to Postgres Changes delivery.

## File storage strategy

The migration creates four private buckets: `avatars`, `task-attachments`, `documents`, and `daily-report-attachments`. Paths are scoped by entity (`{profile_id}/...`, `{task_id}/...`, `{document_id}/...`, `{report_id}/...`). Store only metadata and the path in PostgreSQL. Validate MIME type/size before upload, use signed URLs for downloads, and delete database metadata and objects together through an authorized server workflow.
