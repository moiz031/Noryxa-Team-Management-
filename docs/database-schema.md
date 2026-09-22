# Database schema (Batch 3)

Batch 3 is additive in `20260903030000_batch3_task_execution.sql`.

- `tasks.parent_task_id`, `start_date`, and `due_date` support nested subtasks and standardized scheduling. `task_is_overdue()` excludes completed/cancelled work.
- `task_checklist_items` stores ordered checklist items and completion state.
- `task_dependencies` stores `task_id` → `depends_on_task_id`; a recursive trigger rejects hierarchy and dependency cycles.
- `time_entries` stores manual entries and running timers. A partial unique index allows one running timer per employee and a GiST exclusion constraint rejects overlapping intervals.
- Existing `task_comments`, `task_attachments`, and immutable `activity_logs` are extended with CRUD/storage activity routes and membership-aware policies.

All new tables have foreign keys, indexes, checks, timestamps, and RLS. Task files remain in the private `task-attachments` bucket and downloads use short-lived signed URLs.

## Organization API notes

- Employee lifecycle state is stored in `employees.employment_status`; the admin activation endpoint also enables the linked `profiles.is_active` account flag.
- `GET/PATCH /api/profile` only permits self-service fields (`full_name`, `phone`, and `timezone`). Role, account activation, and employment state remain administrator-controlled by RLS and lifecycle APIs.
- Department, project, task, and employee collection endpoints support bounded `page`/`pageSize` values and server-side search/filter parameters. These queries continue to run through the authenticated Supabase client so existing RLS policies apply.
