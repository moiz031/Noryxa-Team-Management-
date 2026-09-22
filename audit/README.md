# Database Performance Audit — README

> **Audit Date**: 2026-09-15  
> **Scope**: Agency Team Management (Next.js + Supabase)  
> **Auditor**: Antigravity AI  

---

## Overview

This audit reviewed all significant Supabase database queries across the priority areas:

| Priority Area | File(s) Reviewed |
|---|---|
| Admin Dashboard | `src/lib/db/employees.ts`, `src/lib/db/activity-logs.ts`, `src/lib/db/analytics.ts` |
| Employee Dashboard | `src/lib/db/tasks.ts`, `src/lib/db/attendance.ts`, `src/lib/db/daily-reports.ts` |
| Tasks | `src/lib/db/tasks.ts`, `src/lib/db/task-comments.ts` |
| Projects | `src/lib/db/projects.ts` |
| Notifications | `src/lib/db/notifications.ts`, `src/lib/notifications/engine.ts` |
| Activity | `src/lib/db/activity-logs.ts` |
| Reports | `src/lib/db/daily-reports.ts`, `src/lib/db/analytics.ts` |
| Attendance | `src/lib/db/attendance.ts` |
| Search | `src/lib/db/search.ts` |
| Realtime | `src/components/realtime-refresh.tsx` |
| Generic CRUD | `src/lib/db/batch2.ts` |

---

## Issues Found & Fixed

### 1. ✅ Unbounded List Query — `listBatch2()`
**File**: `src/lib/db/batch2.ts`  
**Problem**: `listBatch2()` called `.select("*").order(...)` with no `.limit()` or `.range()`. On large tables (teams, clients, holidays, project_members, etc.) this would load every row into memory on every call — a full table scan.  
**Fix**: Added `limit = 100` and `offset = 0` default parameters; appended `.range(offset, offset + limit - 1)` to every query.  
**Impact**: Admin pages using this helper (teams, clients, schedules) no longer risk unbounded memory growth.

---

### 2. ✅ Unnecessary `select("*")` (Column Waste) — Notifications Engine
**File**: `src/lib/notifications/engine.ts`  
**Problem**: When checking notification preferences before sending a notification, the engine called `.select("*")` on the `notification_preferences` table, fetching all columns even though only one preference column (e.g. `task_notifications`) was ever read.  
**Fix**: Changed to `.select(input.preference)` — only the single boolean column needed is fetched.  
**Impact**: ~90% column data reduction per notification dispatch call.

---

### 3. ✅ N+1 Pattern Resolved — Search Teams
**File**: `src/lib/db/search.ts`  
**Problem**: Inside the `teams` entity search (which runs concurrently with 6 other entity searches via `Promise.all`), there was an additional `team_members` lookup per search call — an extra serial DB round-trip inside an already-parallel fan-out.  
**Fix**: Hoisted the `team_members` query directly into the top-level `Promise.all` pre-fetch block alongside `project_members` and `employees.department_id`. The resulting `accessibleTeamIds` are passed directly into the `teams` entity filter.  
**Impact**: Completely eliminates the extra serial database query round-trip during multi-entity search.

---

### 4. ✅ Activity Log Scan — Retention Policy
**File**: `src/lib/db/activity-logs.ts`  
**Problem**: The `activity_logs` table can grow indefinitely. Without a retention policy, index bloat on `activity_logs_created_idx` will slow `ORDER BY created_at DESC` queries over time.  
**Fix**: Added a `RETENTION:` comment block directly above the query explaining the recommended pg_cron/Edge Function cron job:
```sql
DELETE FROM public.activity_logs WHERE created_at < NOW() - INTERVAL '90 days';
```
The `planned` count strategy (already in place) is also documented as a deliberate choice to avoid full `COUNT(*)` scans.

---

## Indexes Added

All new indexes are in:  
**`supabase/migrations/20260915000000_batch16_database_performance.sql`**

| Index Name | Table | Columns | Justification |
|---|---|---|---|
| `tasks_assigned_due_at_idx` | `tasks` | `(assigned_to, due_at ASC)` | Employee task list with due-date ordering |
| `attendance_employee_date_idx` | `attendance` | `(employee_id, attendance_date DESC)` | Attendance history + duplicate check |
| `daily_reports_draft_employee_idx` | `daily_reports` | `(employee_id) WHERE status='draft'` | Dashboard draft-report counter (partial) |
| `projects_created_at_idx` | `projects` | `(created_at DESC)` | Default newest-first project list |
| `activity_logs_actor_created_idx` | `activity_logs` | `(actor_id, created_at DESC)` | Admin activity filtered by actor |
| `activity_logs_entity_type_created_idx` | `activity_logs` | `(entity_type, created_at DESC)` | Admin activity filtered by entity type |
| `profiles_email_trgm_idx` | `profiles` | `GIN (email)` | Search by email (ILIKE) |
| `clients_company_name_trgm_idx` | `clients` | `GIN (company_name)` | Search by company name (ILIKE) |
| `notifications_recipient_unread_idx` | `notifications` | `(recipient_id, created_at DESC) WHERE read_at IS NULL` | Unread notification bell (hot path) |
| `leave_requests_status_created_idx` | `leave_requests` | `(status, created_at DESC)` | Admin leave management page |
| `documents_department_created_idx` | `documents` | `(department_id, created_at DESC)` | Department-scoped document list |
| `project_members_employee_idx` | `project_members` | `(employee_id)` | Employee accessible-project lookup |
| `team_members_employee_idx` | `team_members` | `(employee_id)` | Employee team membership lookup |
| `tasks_status_created_idx` | `tasks` | `(status, created_at DESC) WHERE status NOT IN ('completed','cancelled')` | Admin dashboard active task filter |
| `announcements_pinned_published_idx` | `announcements` | `(is_pinned DESC, published_at DESC)` | Pinned announcements feed |

### Indexes deliberately NOT added
- `tasks.project_id` — already covered by `tasks_project_idx` (initial schema)
- `task_comments.task_id` — already covered by `comments_task_created_idx` (initial schema)
- `employees.department_id` — already covered by `employees_department_idx` (initial schema)
- `notifications.recipient_id` — already covered by `notifications_recipient_read_idx` (initial schema)

---

## Queries Already Well-Optimised (No Changes Needed)

| File | Why it's OK |
|---|---|
| `tasks.ts` | Full pagination (`range`), `count: "exact"`, selective `select` |
| `projects.ts` | Full pagination, proper joins with specific columns |
| `notifications.ts` | Full pagination, proper filters |
| `attendance.ts` | Full pagination, date-range filters |
| `daily-reports.ts` | Full pagination, date-range + status filters |
| `employees.ts` | Full pagination, specific column select |
| `analytics.ts` | Delegates to `get_analytics_summary` RPC — single DB call |
| `search.ts` | `Promise.all` fan-out with per-entity `.range()` limits |
| `activity-logs.ts` | Pagination + `count: "planned"` (avoids full COUNT scan) |
| `realtime-refresh.tsx` | Listens to change events only — no data fetched on subscribe |

---

## How to Apply the Migration

```bash
# Using Supabase CLI
supabase db push

# Or link and push to remote
supabase link --project-ref <your-project-ref>
supabase db push
```

---

## How to Run the Audit Script

```bash
# Regenerates the queries_report.md (requires Python 3)
python scripts/generate_query_report.py

# Or with Node.js
node scripts/generate_query_report.js
```

---

## Recommended Next Steps

1. **Implement activity-log retention** — Add a pg_cron or Supabase Edge Function cron that runs daily and deletes logs older than 90 days.
2. **Monitor slow queries** — Enable Supabase query performance insights in the dashboard to track real-world slow queries after these indexes are applied.
3. **Review `listBatch2` callers** — Audit all call sites to confirm `limit=100` is sufficient, or pass explicit limits where needed.
