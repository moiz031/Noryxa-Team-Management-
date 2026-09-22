# Database schema

The migrations under `supabase/migrations/` are the executable source of truth. Batch 3 uses the additive task-execution migrations, Batch 4 uses the communication/notification migrations, and Batch 4.1 adds `20260903040200_batch4_1_notification_deduplication.sql` for idempotent event fan-out. Every table uses UUID primary keys and UTC `timestamptz` audit timestamps where applicable.

## Entities and relationships

| Table | Purpose and key relationships |
| --- | --- |
| `profiles` | One-to-one with `auth.users`; stores synchronized email, points to `roles`, and stores identity settings/active state. |
| `roles` | `admin` and `employee` role catalog with a JSON permission extension point. |
| `departments` | Organization groups; employees and documents can belong to one. |
| `employees` | Staff record for a profile; belongs to a department, has `pending/active/suspended/inactive` status, and can have a self-referencing manager. |
| `projects` | Work containers; optionally belong to a department/client and own many tasks. |
| `clients` | Customer records referenced by projects through `projects.client_id`. |
| `teams` / `team_members` | Teams with department, lead employee, lifecycle status, and employee membership. |
| `work_schedules` / `schedule_assignments` | Weekly working hours and dated employee assignments. |
| `holidays` | Company-wide or department-specific non-working dates. |
| `project_members` | Project membership with owner, manager, member, or viewer role. |
| `tasks` | Work items with optional project/parent, assignment, priority, start date, due date, and overdue semantics. |
| `task_checklist_items` | Ordered checklist items with completion state. |
| `task_dependencies` | Directed dependencies; database trigger rejects cycles. |
| `time_entries` | Manual and running task timers with overlap protection. |
| `task_comments` | Comments authored by profiles on tasks. |
| `task_attachments` | File metadata for a task attachment Storage object. |
| `daily_reports` | One report per employee per date, with draft/submitted/reviewed status. |
| `daily_report_attachments` | File metadata for a daily report Storage object. |
| `attendance` | One attendance record per employee per date, with check-in/out timestamps, late-minute tracking, and a database constraint preventing invalid checkout order. |
| `leave_requests` | Employee date range request with pending/approved/rejected/cancelled status. |
| `announcements` | Admin-authored all-agency or department-targeted messages. |
| `notifications` | Per-profile notifications, optionally linked to an entity, with `read_at`, actor, metadata, and a unique event dedupe key. |
| `notification_preferences` | Per-profile category preferences for in-app notifications. |
| `feed_posts` | Team- or project-scoped internal updates. |
| `feed_comments` | Threaded comments and replies on feed posts. |
| `reactions` | Controlled, de-duplicated reactions on supported entities. |
| `mentions` | Authorized profile mentions linked to feed/task entities. |
| `activity_logs` | Append-only actor/action/entity/metadata audit stream for the admin activity feed. |
| `automation_jobs` | Server-only idempotent job claims for Batch 5 automation windows; records status, attempts, payload, and failure details. |
| `documents` | Private file metadata with optional employee/department ownership. |

Cardinality summary: `profiles 1—1 employees`, `roles 1—many profiles`, `departments 1—many employees/projects/documents/teams`, `clients 1—many projects`, `teams many—many employees`, `projects 1—many tasks/feed posts`, `tasks 1—many subtasks/checklist items/dependencies/comments/attachments/time entries`, `feed posts 1—many threaded feed comments`, `employees 1—many time entries/reports/attendance/leave`, and `profiles 1—many notifications/activity events/preferences`.

## Status and audit fields

Enums prevent invalid lifecycle values for employee, task, project, report, attendance, leave, and announcement audience states. The Phase 2 additive migration converts the Phase 1 employee values (`invited`, `on_leave`) to the current lifecycle (`pending`, `active`) without editing the applied Phase 1 migration. All mutable tables have `updated_at` maintained by a trigger. Critical mutations should set `updated_by` and create a corresponding activity event.

Important uniqueness constraints are `(employee_id, report_date)` and `(employee_id, attendance_date)`, plus unique storage paths and department/role names. Indexes cover assignment/status, dates, notification unread state, activity chronology, and common foreign-key filters.

## Activity logging model

Call the `public.log_activity(action_type, entity_type, entity_id, metadata)` RPC from authorized server mutations. The function derives `actor_id` from `auth.uid()` so callers cannot impersonate another actor. The Phase 2 onboarding endpoint records `employee.invited`. Examples also include `employee.joined`, `employee.profile_updated`, `task.created`, `task.assigned`, `task.status_changed`, `task.completed`, `comment.added`, `file.uploaded`, `daily_report.submitted`, `attendance.checked_in`, `leave.requested`, `announcement.created`, and `employee.approved`.

`metadata` should contain safe display context such as old/new status, task title, file name, or department name. Do not put secrets, access tokens, or sensitive raw request bodies into the log.

Daily operations APIs validate ISO dates and bounded text fields. Clock-in rejects holidays, approved leave, and scheduled non-working days. Administrators can correct attendance timestamps/status/notes through the audited attendance correction endpoint; leave review is limited to pending requests and report review to submitted reports.

## Batch 5 automation

`POST /api/admin/automation` runs the protected server-side automation window. A unique job idempotency key prevents concurrent/repeated daily windows from being claimed twice. It sends overdue-task notifications and missing daily-report reminders through the existing notification dedupe/preference path, records completion/failure in `activity_logs`, and records job failures without weakening RLS. Report reminders skip existing reports, inactive employees, holidays, approved leave, and non-working days from assigned weekly schedules (or weekends when no schedule is assigned). Onboarding-on-active is not enabled because the current schema has no onboarding checklist/workflow entity.
