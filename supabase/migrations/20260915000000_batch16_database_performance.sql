-- Batch 16: indexes justified by production query shapes.
-- Do not add broad single-column indexes: each index below supports a hot
-- filter/order pair or an existing wildcard search predicate.

-- Employee task list: assigned_to equality followed by due-date ordering.
create index if not exists tasks_assigned_due_at_idx
  on public.tasks (assigned_to, due_at asc)
  where assigned_to is not null;

-- Employee attendance history and the employee/date duplicate check.
create index if not exists attendance_employee_date_idx
  on public.attendance (employee_id, attendance_date desc);

-- Employee dashboard's draft-report counter. A partial index keeps writes and
-- storage small because only draft rows are relevant to this query.
create index if not exists daily_reports_draft_employee_idx
  on public.daily_reports (employee_id)
  where status = 'draft';

-- Default project lists are newest-first, including the employee project page.
create index if not exists projects_created_at_idx
  on public.projects (created_at desc);

-- Admin activity history is newest-first and commonly filtered by actor or
-- entity type. The entity-id variant already has a pre-existing index.
create index if not exists activity_logs_actor_created_idx
  on public.activity_logs (actor_id, created_at desc)
  where actor_id is not null;
create index if not exists activity_logs_entity_type_created_idx
  on public.activity_logs (entity_type, created_at desc)
  where entity_type is not null;

-- The global search API uses ILIKE '%term%' for these fields. Batch 9 already
-- covers primary names; these complete the two searched secondary fields.
create extension if not exists pg_trgm;
create index if not exists profiles_email_trgm_idx
  on public.profiles using gin (email gin_trgm_ops)
  where email is not null;
create index if not exists clients_company_name_trgm_idx
  on public.clients using gin (company_name gin_trgm_ops)
  where company_name is not null;

-- Notifications: the employee notification feed filters by recipient_id and
-- optionally unread_only (read_at IS NULL). The initial schema index covers
-- (recipient_id, read_at, created_at desc) which handles both cases.
-- Adding a partial index for unread-only queries which are the hot path on
-- the employee dashboard notification bell.
create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

-- Leave requests: admin lists are filtered by status; adding status+created_at
-- to support the admin leave management page ordering.
create index if not exists leave_requests_status_created_idx
  on public.leave_requests (status, created_at desc);

-- Task comments: ordered by task_id + created_at (already exists via
-- comments_task_created_idx). No additional index needed here.

-- Documents: filtered by department_id for department-scoped document lists.
-- owner_id+department_id composite already exists. Adding partial index for
-- department-only queries (no owner filter) used in admin document view.
create index if not exists documents_department_created_idx
  on public.documents (department_id, created_at desc)
  where department_id is not null;

-- Project members: employee search uses eq(employee_id) to get accessible
-- project IDs. Ensure this lookup is fast.
create index if not exists project_members_employee_idx
  on public.project_members (employee_id);

-- Team members: employee search for team membership uses eq(employee_id).
create index if not exists team_members_employee_idx
  on public.team_members (employee_id);

-- Tasks: status filter is a common admin dashboard filter. Partial indexes
-- for active statuses keep the index small and writes fast.
create index if not exists tasks_status_created_idx
  on public.tasks (status, created_at desc)
  where status not in ('completed', 'cancelled');

-- Tasks: project_id filter for project detail page task list.
-- Already covered by tasks_project_idx from initial schema.
-- No additional index needed.

-- Announcements: pinned announcements shown at top of feed.
create index if not exists announcements_pinned_published_idx
  on public.announcements (is_pinned desc, published_at desc)
  where published_at is not null;
