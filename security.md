# Security and access control

## Role model

There are two primary roles: `admin` and `employee`. The role is stored through `profiles.role_id -> roles.code`. New Auth users are created as employees by the database trigger. The first administrator is provisioned once by `scripts/provision-first-admin.mjs` with a service-role key on a trusted operator machine. Later employees are invited only through the admin-only server endpoint, which accepts only the literal `employee` role. There is no public signup path to create an admin.

Admins can manage and monitor organization records. Employees can read and mutate only their own profile/work records, assigned tasks, permitted task comments/files, department announcements, own reports, attendance, leave requests, notifications, and explicitly shared documents. Employees have no read policy for `activity_logs` and no admin route access.

## RLS strategy

RLS is enabled for every application table and all Storage objects. The `is_admin()` and `employee_id_for_user()` functions are `security definer`, use a fixed `search_path`, and centralize the identity check. Policies are deny-by-default unless a specific `select`, `insert`, `update`, or `delete` policy grants access. A Phase 2 trigger also rejects non-admin changes to `profiles.role_id` or `profiles.is_active`, closing self-promotion through an otherwise valid self-profile update.

The migration plans/implements these boundaries:

- `profiles` and `employees`: self or admin; admin manages organization records.
- `roles`, `departments`, `announcements`: authenticated read where appropriate; admin write.
- `projects` and `tasks`: admin, creator, assigned employee, or authorized project member; project members can read tasks and owner/manager/member roles can update them (viewer is read-only).
- `teams`, schedules, holidays, and clients: admins manage; employees see only their team/schedule and applicable holidays, while clients are visible through authorized projects.
- comments, checklist items, dependencies, and attachments: task/project participants, author/uploader, or admin; task attachment downloads are signed for five minutes. The Batch 3 hardening migration binds child-record RLS to `can_access_task()` and prevents cross-task reassignment through direct table access.
- reports, attendance, and leave: owning employee or admin.
- notifications: recipient or admin; employees can mark their own read state.
- `activity_logs`: admin read only; inserts go through the actor-bound `log_activity()` function.
- feed posts/comments are limited to team or project membership; authors/admins control edits and deletes, and reactions are unique per actor/entity/reaction.
- mentions are resolved against authorized team/project participants before a mention row and notification are created.
- notification preferences are readable and writable only by the owning profile; notifications remain recipient-scoped.
- Batch 4.1 derives recipients from task assignment, project membership, report ownership, and leave ownership; callers cannot supply arbitrary recipient IDs. Notification `dedupe_key` prevents repeated delivery for the same event.
- Task-comment mentions are resolved only against the task assignee, creator, and project members; unauthorized profiles are never exposed to the client.
- `documents`: admin, uploader, owner, or matching department, with server-side sharing checks.
- `automation_jobs`: server-only with no authenticated policies; only the guarded admin route and service-role worker can claim/update jobs. Automation still uses notification preferences and unique dedupe keys, so retries do not create duplicate deliveries.

RLS policies must be tested with at least one admin, two employees in separate departments, and an unauthenticated client. A UI route guard is never considered sufficient authorization.

## Storage controls

All buckets are private. Uploads use entity-scoped paths and are initiated by an authorized server workflow after checking the related row. Downloads use short-lived signed URLs. Enforce file size and MIME allowlists in server code, normalize file names, and never render an uploaded HTML/SVG file as trusted application markup.

Task attachment uploads are performed only after an RLS-authorized task lookup and metadata is tied to the uploaded object path; object reads additionally require task metadata membership. The service-role client is used only inside guarded server workflows and never exposed to the browser.

## Operational rules

Keep the publishable key in client code only; never expose a service-role key, database password, or private storage URL. The privileged client is imported only by the server-side onboarding route and provisioning script. Validate all form and route-handler input with Zod. Rate-limit authentication and file endpoints, record safe audit metadata, review Supabase Auth redirect allowlists, and rotate secrets through the deployment platform.

## Verification

`verify-protected-routes.mjs` checks that unauthenticated requests to `/dashboard` and `/admin` redirect to `/login`. `verify-rls.mjs` requires `VERIFY_ADMIN_EMAIL`, `VERIFY_ADMIN_PASSWORD`, `VERIFY_EMPLOYEE_EMAIL`, and `VERIFY_EMPLOYEE_PASSWORD` in `.env.local`; it then signs in dedicated accounts and verifies self access, cross-role separation, roles/departments access, employee record scope, anonymous profile denial, and that an employee cannot update their own role to `admin`. Run both only against a non-production test dataset unless the operator explicitly intends otherwise.
