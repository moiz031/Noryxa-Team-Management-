# Comprehensive Queries Report & Audit Mapping

Generated on 2026-09-15

This report catalogs critical database queries across all prioritized domains in the Agency Team Management application, evaluating them against performance indicators (N+1 queries, indexing needs, unbounded lists, aggregation overhead, and joins).

---

## 1. Summary of Priority Domains & Query Inventory

### Admin & Employee Dashboards
- `src/lib/db/employees.ts`:
  - `getEmployees()`: Paginated via `.range(from, to)`, selective column select (`id, department_id, reports_to, designation, status, profiles(...)`). Uses `employees_department_idx` and `employees_reports_to_idx`.
  - `getEmployeeById()`: Single-row lookup by PK `id`.
- `src/lib/db/analytics.ts`:
  - `getAnalyticsSummary()`: Calls Postgres RPC function `get_analytics_summary(target_date)`. Single aggregate call; avoids expensive multi-table application-layer joins.
- `src/lib/db/activity-logs.ts`:
  - `getActivityLogs()`: Paginated via `.range(from, to)`, uses `{ count: "planned" }` to prevent full sequential table count scans on large tables.
  - New composite indexes added: `activity_logs_actor_created_idx` on `(actor_id, created_at desc)` and `activity_logs_entity_type_created_idx` on `(entity_type, created_at desc)`.
  - Retention policy documented (archive/prune after 90 days).

### Tasks & Task Comments
- `src/lib/db/tasks.ts`:
  - `getTasks()`: Standard pagination (`from, to`), exact count option, selective join on `projects` and `employees`.
  - Filtered by `assigned_to`, `status`, `project_id`, `priority`, `due_date`.
  - New indexes added:
    - `tasks_assigned_due_at_idx` on `(assigned_to, due_at asc)` for employee dashboard priority task lists.
    - `tasks_status_created_idx` partial index on `(status, created_at desc) WHERE status NOT IN ('completed', 'cancelled')` for active task views.
- `src/lib/db/task-comments.ts`:
  - `getTaskComments()`: Filtered by `task_id`, ordered by `created_at asc`.
  - Covered by pre-existing composite index `comments_task_created_idx`.

### Projects & Project Members
- `src/lib/db/projects.ts`:
  - `getProjects()`: Paginated with `.range(from, to)`, selective join with `clients` and `employees`.
  - Ordered by `created_at desc`.
  - New index added: `projects_created_at_idx` on `projects(created_at desc)` for efficient newest-first listings.
  - Pre-existing index `projects_client_idx` covers client filters.
  - New index added: `project_members_employee_idx` on `project_members(employee_id)` to speed up permission checks and employee project lookups.

### Attendance & Daily Reports
- `src/lib/db/attendance.ts`:
  - `getAttendanceRecords()`: Filtered by employee, status, and date range (`attendance_date.gte` / `lte`).
  - New index added: `attendance_employee_date_idx` on `(employee_id, attendance_date desc)` to optimize attendance timeline queries and check duplicate daily punches.
- `src/lib/db/daily-reports.ts`:
  - `getDailyReports()`: Filtered by `employee_id`, `status`, and date boundaries.
  - New index added: `daily_reports_draft_employee_idx` partial index on `(employee_id) WHERE status = 'draft'` for the dashboard draft report badge counter.

### Notifications & Preferences
- `src/lib/db/notifications.ts`:
  - `getNotifications()`: Filtered by `recipient_id`, `is_read`.
  - New partial index added: `notifications_recipient_unread_idx` on `(recipient_id, created_at desc) WHERE read_at IS NULL` for unread notifications bell queries.
- `src/lib/notifications/engine.ts`:
  - Optimized: Replaced `select("*")` on `notification_preferences` with selective single-column select (`select(input.preference)`), eliminating unnecessary column fetching overhead.

### Global Search & Autocomplete
- `src/lib/db/search.ts`:
  - `multiEntitySearch()`: Concurrently queries tasks, projects, employees, teams, clients, documents, announcements using `Promise.all` and ILIKE term matching.
  - Optimized (N+1 resolved): Hoisted employee team membership query into the top-level pre-fetch `Promise.all` block alongside accessible projects, eliminating a serial nested database round-trip.
  - New trigram GIN indexes added:
    - `profiles_email_trgm_idx` on `profiles using gin (email gin_trgm_ops)`
    - `clients_company_name_trgm_idx` on `clients using gin (company_name gin_trgm_ops)`
    - Complements Batch 9 GIN indexes on primary names/titles.

### Generic Administrative Tables (Batch 2)
- `src/lib/db/batch2.ts`:
  - `listBatch2()`: Previously unbounded `.select("*")`.
  - Optimized: Added default `limit = 100` and `offset = 0` with `.range(offset, offset + limit - 1)` to prevent unbounded full-table scans across teams, clients, holidays, and schedules.

---

## 2. Key Audit Decisions & Rationale

1. **Selective Partial Indexing Over Broad Indexing**:
   - Instead of indexing every column or adding heavy full-table indexes, partial indexes (`WHERE read_at IS NULL`, `WHERE status = 'draft'`, `WHERE status NOT IN ('completed', 'cancelled')`) were implemented. This keeps write overhead minimal while giving high-speed performance to the hot read paths.
2. **Trigram Search GIN Indexes**:
   - Applied strictly to text fields subjected to wildcard `ILIKE %term%` searches (`profiles.email`, `clients.company_name`).
3. **Preventing Full Count Scans**:
   - Adopted `{ count: "planned" }` in high-volume logging tables (`activity_logs`) to rely on PostgreSQL statistics rather than sequential row counting.
4. **Guarded Unbounded Reads**:
   - Enforced default range limits (`limit=100`) on generic table fetchers to guard against memory spikes as records scale.
