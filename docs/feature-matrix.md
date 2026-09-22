# Feature matrix

Status meanings: **EXISTING** = usable implementation in checked-in code; **PARTIAL** = foundation or a slice exists but the workflow is incomplete; **MISSING** = no implementation found; **NEEDS REVIEW** = code exists but behavior/security/requirements need validation before calling it complete.

| Feature | Status | Evidence / notes |
|---|---|---|
| Public landing page | EXISTING | `src/app/page.tsx`; static Phase 1 foundation messaging. |
| Employee email/password signup | EXISTING | `register/page.tsx`; Auth signup with full name; trigger creates employee profile/row. |
| Employee login | EXISTING | `login/page.tsx`; password sign-in and dashboard redirect. |
| Administrator login | EXISTING | `admin/login/page.tsx`; role checked before redirect. |
| Email confirmation callback | EXISTING | `auth/callback/route.ts`; exchanges PKCE code and routes by database role. |
| Password recovery/reset | EXISTING | `forgot-password`, `reset-password`, callback configuration. |
| Server session refresh/sign-out | EXISTING | SSR clients, `proxy.ts`, `auth/signout/route.ts`. |
| First-admin provisioning | EXISTING | `scripts/provision-first-admin.mjs`; service-role trusted script. |
| Admin employee invitation | EXISTING | `POST /api/admin/employees`; Zod validation, Auth invite, employee-only role. |
| Employee activation/approval UI | PARTIAL | Admin activation transition API (`POST /api/admin/employees/:id/activate`) updates both employment and account state; UI remains out of scope. |
| Employee directory/list | PARTIAL | Admin list page and data/API reads support status, department, search, and bounded pagination; visible controls and detail/new routes remain absent. |
| Employee profile/self-service | EXISTING | Authenticated `GET/PATCH /api/profile` exposes safe profile fields; avatar lifecycle is available separately and profile RLS remains enforced. |
| Departments CRUD | PARTIAL | DB module and admin collection/item APIs exist, including search, active filtering, and bounded pagination; no department UI route. |
| Role catalog/permissions | PARTIAL | Two seeded roles and JSON permissions exist; no permission editor or granular permission enforcement. |
| Role escalation prevention/last-admin protection | EXISTING | Phase 2 triggers in migrations; should be covered by live verification. |
| Admin dashboard | PARTIAL | `/admin` shell links to modules; no metrics, activity feed, or operational widgets. |
| Employee dashboard | PARTIAL | `/dashboard` protected shell with placeholder cards; no data or workflows. |
| Project CRUD | PARTIAL | DB module and admin GET/POST/item PATCH/DELETE APIs; list UI is read-only and new/detail routes are absent. |
| Project assignment/membership | EXISTING | `project_members` supports owner/manager/member/viewer roles, RLS, API, and project visibility. |
| Task CRUD | EXISTING | Admin and employee APIs, validated scheduling fields, hierarchy, filters, and membership-aware RLS. |
| Task status/priority/due dates | EXISTING | Standardized priority/start/due dates, overdue filtering, completion behavior, and validated mutations. |
| Task comments | EXISTING | Authenticated list/create/update/delete API with author/admin ownership controls and activity-compatible storage. |
| Task attachments | EXISTING | Private upload, metadata, signed download, delete API, size validation, cleanup, and membership checks. |
| Task subtasks/checklists/dependencies | EXISTING | Parent task hierarchy, ordered checklist items with create/update/complete/delete APIs, dependency API, database cycle prevention, and task-bound RLS. |
| Daily report submission | EXISTING | Table, DB module, employee GET/POST/PATCH APIs, and employee form/page. |
| Daily report admin review | EXISTING | Admin list/review APIs and `/admin/daily-reports` review workflow. |
| Daily report attachments | EXISTING | Authenticated list/upload/signed-download/delete APIs validate uploader-scoped paths, object existence, size limits, RLS, cleanup, and activity events. |
| Attendance recording | EXISTING | Employee clock-in/out and history APIs enforce assigned schedules, holidays, approved leave, and non-working days; admin correction API validates timestamps and audits changes. |
| Leave request submission | PARTIAL | Table, DB module, employee GET/POST; no employee form. |
| Leave approval/rejection | EXISTING | Status/reviewer fields, admin mutation endpoint, and `/admin/leave` approval workflow. |
| Announcements publishing | EXISTING | Admin CRUD APIs, creation form at `/admin/announcements`, and employee announcement page. |
| Department-targeted announcements | EXISTING | Enum, constraint, RLS predicate, and API fields support it; end-to-end display workflow absent. |
| Notifications inbox/read state | PARTIAL | Table, RLS, DB helpers, GET/PATCH API, event/automation creation, and dedupe; no notification UI. |
| Communication feed/comments/replies | EXISTING | Team/project-scoped feed posts, threaded comments, authorization, activity logging, and realtime publication are available through `/api/feed`. |
| Mentions and reactions | PARTIAL | Authorized feed-comment mention resolution and notification generation plus controlled de-duplicated reactions are implemented; task-comment mention support remains. |
| Notification center/preferences | EXISTING | Recipient-scoped list/read APIs, unread counts, realtime publication, preference API, and event notifications for announcements/feed activity are implemented. |
| Event-driven notification fan-out | EXISTING | Existing event fan-out plus protected Batch 5 automation for overdue tasks and missing daily reports; notification preferences and dedupe keys are honored. |
| Task-comment mentions | EXISTING | Mentions resolve only against authorized task participants, create mention rows, deduplicated notifications, and activity events. |
| Activity/audit log | PARTIAL | Table, admin read module, `log_activity()` RPC; selected APIs write directly and no admin activity page exists. |
| Documents library | EXISTING | Authenticated list/upload/signed-download/update/delete APIs cover metadata and private-object lifecycle with RLS and activity events. |
| Avatar upload | EXISTING | Authenticated profile avatar set/remove workflow validates object scope/existence, cleans replaced objects, and records activity. |
| Private Storage | EXISTING | Four private buckets declared in migration and local Storage enabled. |
| Storage entity isolation | EXISTING | Task, document, report, and avatar object access is tied to authenticated metadata, scoped paths, RLS, and signed-download checks. |
| Signed URLs and file lifecycle | EXISTING | Document, task, report, and avatar APIs preflight uploaded objects, issue short-lived signed URLs, validate scoped paths/size, and remove objects with metadata. |
| Realtime activity/notifications/tasks | EXISTING | Dedicated authenticated two-session E2E delivered task, report, leave request/approval, mention notification, and notification read-state events without refresh. |
| Realtime attendance/reports/announcements | EXISTING | Workflow publication coverage and authenticated event delivery are verified; visual client presentation remains outside this batch. |
| Auth route protection | EXISTING | Proxy plus server `requireAdmin`/`requireEmployee` guards. |
| Database RLS | EXISTING | All application tables and Storage objects have RLS/policies in migrations. |
| RLS verification | EXISTING | Authenticated RLS, full-system isolation, Storage, route, and automation checks pass with dedicated verification accounts. |
| API input validation | PARTIAL | Storage workflows and daily operations use shared Zod validation; broader CRUD handlers/data modules still accept JSON/params without a shared schema layer. |
| API audit consistency | NEEDS REVIEW | Activity writes are present in many mutations but not uniformly through actor-bound `log_activity()`. |
| Search/filter/pagination | PARTIAL | Data modules support filters/pagination; visible controls do not submit/filter and no global search exists. |
| Responsive visual system | PARTIAL | Tailwind pages and Button primitive exist; most product screens/components are absent. |
| Client/customer management | EXISTING | `clients`, project `client_id`, admin APIs, and client detail/list pages. |
| Calendar/scheduling | PARTIAL | Work schedules, employee assignments, holidays, RLS, APIs, and admin pages are delivered; calendar UI is out of scope. |
| Time tracking/timesheets | EXISTING | Task time entries support timers/manual entries, ownership, overlap prevention, and admin filters via API. |
| Billing/invoicing/payments | MISSING | No schema, APIs, routes, or integrations. |
| Reporting/analytics/export | PARTIAL | Bounded `GET /api/analytics` and RLS-aware `get_analytics_summary` aggregates tasks, attendance, daily reports, and tracked time for admins or the authenticated employee; no UI, export, or report builder. |
| Email/push notification delivery | MISSING | Notifications table exists; no delivery worker/provider/orchestration. |
| Background jobs/queues | PARTIAL | Server-only `automation_jobs` claims and `POST /api/admin/automation` provide idempotent execution for overdue-task and missing-report windows; live migration and idempotency verification passed, but no external scheduler/queue is included. |
| Automated test suite | PARTIAL | Authenticated verification scripts cover RLS, route protection, full-system isolation, automation idempotency, and Realtime; a framework-based unit/integration suite is still absent. |

## Overall classification

The strongest delivered areas are authentication/session handling, the PostgreSQL/RLS foundation, and a subset of admin/employee API handlers. Most business features are **PARTIAL** because schema and data-access code precede pages, mutations, file workflows, or tests. The database should not be used as evidence that the corresponding UI workflow is implemented.
