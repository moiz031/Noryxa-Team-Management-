# Final product architecture audit

**Audit scope.** This is a repository audit, not an implementation plan. It covers the checked-in `src/`, `supabase/migrations/`, `supabase/config.toml`, scripts, and existing documentation. The repository describes Phase 1 and a Phase 2 authentication/onboarding backend; there is no code or migration labelled Phase 3–9. References to later phases in `architecture.md` are planned structure, not delivered functionality.

## A. Existing architecture

- Next.js 16.3.4 App Router, TypeScript, React 19, Tailwind, and one reusable Button primitive.
- Supabase is the identity, PostgreSQL, Storage, and intended Realtime platform.
- Browser and cookie-aware server clients use `@supabase/ssr`; a server-only service-role client is used by privileged route handlers and provisioning.
- `src/proxy.ts` delegates to the cookie/session refresh and coarse route gate in `src/lib/supabase/middleware.ts`.
- Server-side role/profile guards are in `src/lib/auth/context.ts` and `roles.ts`.
- Database access modules exist for departments, employees, projects, tasks, daily reports, attendance, leave requests, announcements, notifications, documents, and activity logs.
- The database foundation now includes additive Batch 2 organization operations: teams/team members, work schedules and assignments, holidays, clients, project client links, and project member roles, with audit timestamps, indexes, constraints, helper functions, and RLS.
- Batch 3 adds task hierarchy/checklists/dependencies, date/overdue semantics, protected time entries, comment CRUD, private task attachment workflows, and task-bound child-record RLS hardening.
- Batch 4 adds team/project feed posts, threaded replies, controlled reactions, authorized mentions, notification preferences, announcement notification fan-out, and notification realtime publication.
- Batch 4.1 adds idempotent event fan-out for task/report/leave workflows and task-comment mentions constrained to authorized task participants.
- Batch 5 adds a protected server-side automation endpoint and idempotent job model for overdue-task notifications and schedule/holiday/approved-leave-aware missing-report reminders. The current schema has no onboarding workflow entity, so onboarding-on-active remains unsupported.
- Existing rendered pages are the public landing page, login/register/recovery/reset pages, one employee dashboard shell, an admin shell, and admin list pages for employees/projects/tasks. Several links point to pages that do not exist.

## B. Partial or scaffolded architecture

- Domain repositories and API handlers are present, but most are not connected to user-facing forms/workflows. The UI is explicitly a shell in `dashboard/page.tsx`.
- Admin employee, project, and task list pages read data, but their filters are uncontrolled presentation controls and their “new” and detail links have no matching page in `src/app`.
- CRUD helpers exist for all major entities, while route coverage is selective (for example, no employee-facing document upload route and no comments route).
- Audit logging is modeled and some routes write directly to `activity_logs`; the documented `log_activity()` RPC is not consistently used.
- Realtime is enabled in the migration publication when available, but no client subscription/channel code exists.
- Storage buckets and object policies exist, but no application upload, signed-download, or cleanup workflow exists.

## C. Missing product capabilities

Employee daily-report, attendance, leave-request, and announcement pages plus admin review screens are delivered. Task detail/file UX, notifications UI, documents upload lifecycle, profile settings, and complete authenticated realtime verification remain. There is no billing/invoicing, calendar, timesheet, payroll, search, exports, analytics, or external email notification orchestration. Batch 5 provides a protected, manually invoked automation job foundation but no external scheduler/queue. Verification scripts require a configured live Supabase dataset.

## D. Required modifications (documentation-level recommendations)

1. Treat database foundation, route handlers, data-access functions, and rendered workflows as separate acceptance surfaces; do not call a feature complete when only its table exists.
2. Add a single authoritative API/service boundary for each mutation. Derive actor IDs from the session, validate every body/query parameter with Zod, and use the audit RPC (or a documented equivalent) consistently.
3. Add the missing UI/routes only after defining workflow state transitions (especially employee activation, report review, attendance correction, and leave approval).
4. Tighten Storage object policies with relational checks to the metadata rows; current policies mostly check `owner_id` and can permit access to guessed entity paths.
5. Decide and document whether employee lifecycle `pending` accounts may authenticate/use data. Current route guards check `profiles.is_active`, not `employees.employment_status`.
6. Add focused integration/RLS tests for two employees in different departments, an admin, anonymous access, and storage object access before release.
7. Reconcile stale planned paths in `architecture.md` and links in existing pages with the actual route tree.

## E. Required tables and relationships

The executable schema is the three migrations under `supabase/migrations/`.

| Table | Delivered purpose and relationships |
|---|---|
| `roles` | `admin`/`employee` catalog plus JSON permission extension. |
| `profiles` | One-to-one with `auth.users`; role, synchronized email, identity, timezone, active flag. |
| `departments` | Organization groups referenced by employees, projects, documents. |
| `employees` | Staff extension of a profile; department, manager self-reference, job/lifecycle fields. |
| `projects` | Work container; optional department/client; one-to-many tasks and many-to-many project members. |
| `clients` | Customer records linked to projects. |
| `teams`, `team_members` | Department-scoped teams, leads, lifecycle status, and employee membership. |
| `work_schedules`, `schedule_assignments` | Weekly schedules and dated employee assignments. |
| `holidays` | Company-wide or department-specific non-working dates. |
| `tasks` | Project work item with optional parent, assignment, priority, start/due dates, and overdue helper. |
| `task_checklist_items` | Ordered task checklist items with completion state. |
| `task_dependencies` | Directed task dependencies with database cycle prevention. |
| `time_entries` | Employee task timers/manual entries with overlap constraints. |
| `task_comments`, `task_attachments` | Task child records, CRUD, private Storage metadata and signed downloads. |
| `daily_reports`, `daily_report_attachments` | One report per employee/date and its file metadata. |
| `attendance` | One record per employee/date with status and check-in/out. |
| `leave_requests` | Employee date-range request and review fields. |
| `announcements` | Admin-authored all-agency or department-targeted messages. |
| `notifications` | Per-profile notification inbox and read timestamp. |
| `activity_logs` | Append-only audit stream. |
| `automation_jobs` | Server-only idempotent automation claims and execution status. |
| `documents` | Private file metadata with optional employee/department ownership. |

Important constraints include unique employee profile, report/date, attendance/date, storage paths, date-range validity, and automation idempotency keys. Task watcher and external notification-delivery tables remain out of scope; clients and project membership are now delivered.

## F. Permissions and RLS

RLS is enabled on every application table and `storage.objects`. `is_admin()` and `employee_id_for_user()` are security-definer helpers with fixed search paths. New Auth users receive an employee profile and pending employee row through a trigger. The Phase 2 trigger blocks non-admin role/active-state changes; the hardening migration prevents removing the last active admin.

Effective policy intent:

- Roles/departments: authenticated read; admin write.
- Profiles/employees: self read (where applicable) or admin; admin manages employee rows; profile self update is not sufficient to change role/active state.
- Projects/tasks: admin plus creator/assigned employee reads; admin writes; assigned employees can update assigned tasks.
- Comments/attachments: task participants, author/uploader, or admin according to table policies.
- Reports/attendance/leave: owning employee or admin.
- Announcements: authenticated users receive all or matching-department announcements; admin writes.
- Notifications: recipient or admin read/update.
- Activity logs: admin read; table inserts have no policy and the RPC binds actor to `auth.uid()`.
- Documents: admin/uploader/owner/matching department read; admin/uploader write.

Review items: broad `for all` policies on employee-owned report/attendance/leave records allow lifecycle fields to be changed by the owner unless API validation constrains them; department and role reads expose the complete catalogs to authenticated users; storage task/document/report policies do not verify the referenced metadata row. RLS is authoritative, but no application-level storage workflow currently exists to compensate.

## G. APIs and routes

### Delivered public/auth routes

`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/admin/login`, `/auth/callback`, `/auth/error`, and `/auth/signout`.

### Delivered API handlers

| Area | Routes and methods |
|---|---|
| Admin | `/api/admin/employees` GET/POST; `/api/admin/employees/[id]` GET/PATCH/DELETE; departments, projects, tasks, and announcements each have collection GET/POST and item GET/PATCH/DELETE; `/api/admin/daily-reports`, `/api/admin/attendance`, `/api/admin/leave-requests` GET; `/api/admin/automation` POST. |
| Employee | `/api/employee/tasks` GET and `/api/employee/tasks/[id]` GET/PATCH; daily reports collection GET/POST and item GET/PATCH; attendance GET/POST; leave requests GET/POST. |
| Shared | `/api/announcements` GET and `/api/notifications` GET/PATCH. |

Admin handlers call `requireAdmin()`; employee handlers call `requireEmployee()`; shared handlers call `requireUser()`. Admin mutations commonly use the service-role client after the guard. Missing route handlers include task comments/attachments, documents/storage, employee profile self-service, notification creation/delivery, and explicit approval/review actions. Route handlers should be considered the supported API; data-access CRUD exports are not automatically public endpoints.

## H. Realtime events

The initial migration conditionally adds `activity_logs`, `notifications`, `tasks`, `announcements`, `attendance`, and `daily_reports` to `supabase_realtime`. No `channel`, `on('postgres_changes')`, broadcast, presence, invalidation, or cleanup code is present. Consequently realtime is **database-ready, not implemented as a product behavior**. Future subscriptions should be filtered by record scope and followed by authorized server refetches; event payloads must not replace RLS.

## I. Storage buckets and policies

`supabase/config.toml` enables local Storage with a 50 MiB limit. The migration creates private buckets:

- `avatars`: intended `{profile_id}/...`
- `task-attachments`: intended `{task_id}/...`
- `documents`: intended `{document_id}/...`
- `daily-report-attachments`: intended `{report_id}/...`

Object policies allow authenticated inserts for avatar folder ownership, and owner/admin reads for the other buckets. There are no upload routes, MIME/size validation in application code, signed URL generation, metadata/object transaction workflow, virus scanning, or delete synchronization. Relational checks against task/document/report metadata are explicitly still required.

## J. Authentication and middleware

Email/password signup, sign-in, admin sign-in, confirmation callback, password reset, sign-out, and first-admin provisioning are present. Public signup is employee-only by trigger; the admin invite endpoint validates Zod input and provisions an employee with the service-role client. Session cookies are refreshed in `proxy.ts`; server pages additionally call role guards. Inactive profiles are rejected. `employees.employment_status` is not part of the middleware decision, and auth rate limiting/MFA is not configured in checked-in code.

## K. Unnecessary complexity to avoid

- Do not add a second auth/role system, JWT parsing layer, or client-side authorization source of truth.
- Do not introduce an ORM or duplicate repositories while Supabase typed queries/RLS are the current boundary.
- Do not create separate tables for dashboard counters; derive counters from authoritative tables and use Realtime invalidation.
- Do not add a generic workflow engine for the current finite enums.
- Do not expose the service-role client to Client Components or use it as a replacement for RLS.
- Do not add a client portal, billing, payroll, or analytics subsystem until a corresponding product requirement and data ownership model exists.

## Audit conclusion

The repository is a credible Phase 1 database/security foundation with a partial Phase 2 auth/onboarding implementation and a small set of read-oriented/admin APIs. It is not yet an end-to-end agency management product. The largest gap is not schema breadth; it is the missing, tested workflows and the missing UI/API/storage/realtime wiring that would safely operate the schema.
