# Final API / Database Contract Audit Report

Generated: 2026-09-22T06:33:59.143Z

## 1. Executive Summary

This comprehensive audit checks the end-to-end alignment between:
- **Supabase Migrations** (Executable Source of Truth)
- **Data Access Layer (DAL)** (`src/lib/db/*.ts`)
- **API Routes** (`src/app/api/**/route.ts`)
- **Validation Schemas** (`src/lib/validation/*.ts`)

### Audit Results At a Glance
- **Total DB Tables**: 42
- **DAL Modules**: 19
- **API Endpoints**: 76
- **Validation Schemas**: 18
- **Table Coverage Rate**: 52.4%

## 2. Table Coverage & DAL Alignment

| Table Name | Defined in DB Migrations | Accessed in DAL | Notes |
| :--- | :---: | :---: | :--- |
| `activity_logs` | ✅ | ✅ | Fully supported in DAL |
| `activity_logs_archive` | ✅ | ℹ️ | Automated / Archive / Trigger managed table |
| `announcements` | ✅ | ✅ | Fully supported in DAL |
| `attendance` | ✅ | ✅ | Fully supported in DAL |
| `automation_jobs` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `clients` | ✅ | ✅ | Fully supported in DAL |
| `company_documents` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `daily_report_attachments` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `daily_reports` | ✅ | ✅ | Fully supported in DAL |
| `departments` | ✅ | ✅ | Fully supported in DAL |
| `documents` | ✅ | ✅ | Fully supported in DAL |
| `employee_documents` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `employees` | ✅ | ✅ | Fully supported in DAL |
| `feed_comments` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `feed_posts` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `holidays` | ✅ | ✅ | Fully supported in DAL |
| `knowledge_base_attachments` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `leave_requests` | ✅ | ✅ | Fully supported in DAL |
| `mentions` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `notification_preferences` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `notifications` | ✅ | ✅ | Fully supported in DAL |
| `organization_settings` | ✅ | ✅ | Fully supported in DAL |
| `profiles` | ✅ | ✅ | Fully supported in DAL |
| `project_documents` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `project_members` | ✅ | ✅ | Fully supported in DAL |
| `projects` | ✅ | ✅ | Fully supported in DAL |
| `reactions` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `roles` | ✅ | ℹ️ | Relational / Join table used in nested joins and foreign-key queries |
| `schedule_assignments` | ✅ | ✅ | Fully supported in DAL |
| `sops` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `storage_events` | ✅ | ℹ️ | Automated / Archive / Trigger managed table |
| `task_attachments` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `task_checklist_items` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `task_comments` | ✅ | ✅ | Fully supported in DAL |
| `task_dependencies` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `tasks` | ✅ | ✅ | Fully supported in DAL |
| `team_members` | ✅ | ✅ | Fully supported in DAL |
| `teams` | ✅ | ✅ | Fully supported in DAL |
| `templates` | ✅ | ℹ️ | Direct DAL helper optional or query via join |
| `time_entries` | ✅ | ✅ | Fully supported in DAL |
| `user_notification_preferences` | ✅ | ℹ️ | Relational / Join table used in nested joins and foreign-key queries |
| `work_schedules` | ✅ | ✅ | Fully supported in DAL |

> **Contract Verification**: Zero phantom/extra tables detected in DAL. All DAL queries target verified database tables.

## 3. Detailed Table Schema Inventory

| Table | Column Count | Constraint Count | Key Audit / Lifecycle Columns |
| :--- | :---: | :---: | :--- |
| `activity_logs` | 8 | 0 | id, created_at |
| `activity_logs_archive` | 1 | 0 | N/A |
| `announcements` | 12 | 1 | id, created_at, updated_at |
| `attendance` | 12 | 3 | id, status, created_at, updated_at, seed_tag |
| `automation_jobs` | 11 | 0 | id, status, created_at, updated_at |
| `clients` | 12 | 0 | id, status, created_at, updated_at, seed_tag |
| `company_documents` | 11 | 0 | id, updated_at |
| `daily_report_attachments` | 8 | 0 | id, created_at |
| `daily_reports` | 14 | 1 | id, status, created_at, updated_at, seed_tag |
| `departments` | 9 | 0 | id, created_at, updated_at, seed_tag |
| `documents` | 16 | 0 | id, created_at, updated_at, seed_tag |
| `employee_documents` | 12 | 0 | id, updated_at |
| `employees` | 15 | 0 | id, created_at, updated_at |
| `feed_comments` | 7 | 0 | id, created_at, updated_at |
| `feed_posts` | 8 | 1 | id, created_at, updated_at, seed_tag |
| `holidays` | 10 | 1 | id, created_at, updated_at |
| `knowledge_base_attachments` | 10 | 0 | id, updated_at |
| `leave_requests` | 15 | 1 | id, status, created_at, updated_at, seed_tag |
| `mentions` | 6 | 1 | id, created_at |
| `notification_preferences` | 7 | 0 | updated_at |
| `notifications` | 12 | 0 | id, created_at, seed_tag |
| `organization_settings` | 12 | 0 | id, created_at, updated_at |
| `profiles` | 13 | 0 | id, created_at, updated_at, seed_tag |
| `project_documents` | 12 | 0 | id, updated_at |
| `project_members` | 6 | 1 | created_at, seed_tag |
| `projects` | 14 | 0 | id, status, created_at, updated_at, seed_tag |
| `reactions` | 6 | 1 | id, created_at |
| `roles` | 6 | 0 | id, created_at, updated_at |
| `schedule_assignments` | 5 | 2 | created_at |
| `sops` | 12 | 0 | id, created_at, updated_at |
| `storage_events` | 7 | 0 | id, created_at |
| `task_attachments` | 8 | 0 | id, created_at |
| `task_checklist_items` | 9 | 1 | id, created_at, updated_at |
| `task_comments` | 7 | 0 | id, created_at, updated_at |
| `task_dependencies` | 4 | 2 | created_at |
| `tasks` | 18 | 0 | id, status, created_at, updated_at, seed_tag |
| `team_members` | 3 | 1 | created_at |
| `teams` | 11 | 0 | id, status, created_at, updated_at, seed_tag |
| `templates` | 9 | 0 | id, created_at, updated_at |
| `time_entries` | 9 | 1 | id, created_at, updated_at |
| `user_notification_preferences` | 13 | 1 | id, created_at, updated_at |
| `work_schedules` | 22 | 0 | id, created_at, updated_at |

## 4. API Routes Inventory

| Endpoint Route | HTTP Methods | Source Handler File |
| :--- | :--- | :--- |
| `/api/admin/activity-logs` | `GET` | `api/admin/activity-logs/route.ts` |
| `/api/admin/announcements` | `GET, POST` | `api/admin/announcements/route.ts` |
| `/api/admin/announcements/[id]` | `GET, PATCH, DELETE` | `api/admin/announcements/[id]/route.ts` |
| `/api/admin/attendance` | `GET` | `api/admin/attendance/route.ts` |
| `/api/admin/attendance/[id]` | `PATCH` | `api/admin/attendance/[id]/route.ts` |
| `/api/admin/automation` | `GET, POST` | `api/admin/automation/route.ts` |
| `/api/admin/clients` | `GET, POST` | `api/admin/clients/route.ts` |
| `/api/admin/clients/[id]` | `PATCH, DELETE` | `api/admin/clients/[id]/route.ts` |
| `/api/admin/daily-reports` | `GET` | `api/admin/daily-reports/route.ts` |
| `/api/admin/daily-reports/[id]` | `PATCH` | `api/admin/daily-reports/[id]/route.ts` |
| `/api/admin/departments` | `GET, POST` | `api/admin/departments/route.ts` |
| `/api/admin/departments/[id]` | `GET, PATCH, DELETE` | `api/admin/departments/[id]/route.ts` |
| `/api/admin/employees` | `GET, POST` | `api/admin/employees/route.ts` |
| `/api/admin/employees/[id]` | `GET, PATCH, DELETE` | `api/admin/employees/[id]/route.ts` |
| `/api/admin/employees/[id]/activate` | `POST, PATCH` | `api/admin/employees/[id]/activate/route.ts` |
| `/api/admin/holidays` | `GET, POST` | `api/admin/holidays/route.ts` |
| `/api/admin/holidays/[id]` | `PATCH, DELETE` | `api/admin/holidays/[id]/route.ts` |
| `/api/admin/leave-requests` | `GET` | `api/admin/leave-requests/route.ts` |
| `/api/admin/leave-requests/[id]` | `PATCH` | `api/admin/leave-requests/[id]/route.ts` |
| `/api/admin/project-members` | `GET, POST` | `api/admin/project-members/route.ts` |
| `/api/admin/project-members/[projectId]/[employeeId]` | `PATCH, DELETE` | `api/admin/project-members/[projectId]/[employeeId]/route.ts` |
| `/api/admin/projects` | `GET, POST` | `api/admin/projects/route.ts` |
| `/api/admin/projects/[id]` | `GET, PATCH, DELETE` | `api/admin/projects/[id]/route.ts` |
| `/api/admin/schedule-assignments` | `GET, POST` | `api/admin/schedule-assignments/route.ts` |
| `/api/admin/schedules` | `GET, POST` | `api/admin/schedules/route.ts` |
| `/api/admin/schedules/[id]` | `PATCH, DELETE` | `api/admin/schedules/[id]/route.ts` |
| `/api/admin/tasks` | `GET, POST` | `api/admin/tasks/route.ts` |
| `/api/admin/tasks/[id]` | `GET, PATCH, DELETE` | `api/admin/tasks/[id]/route.ts` |
| `/api/admin/teams` | `GET, POST` | `api/admin/teams/route.ts` |
| `/api/admin/teams/[id]` | `PATCH, DELETE` | `api/admin/teams/[id]/route.ts` |
| `/api/analytics` | `GET` | `api/analytics/route.ts` |
| `/api/announcements` | `GET` | `api/announcements/route.ts` |
| `/api/company-documents` | `GET, POST, DELETE` | `api/company-documents/route.ts` |
| `/api/company-documents/[id]` | `GET, PATCH, DELETE` | `api/company-documents/[id]/route.ts` |
| `/api/cron/automation` | `GET` | `api/cron/automation/route.ts` |
| `/api/documents` | `GET, POST` | `api/documents/route.ts` |
| `/api/documents/[id]` | `GET, PATCH, DELETE` | `api/documents/[id]/route.ts` |
| `/api/employee-documents` | `GET, POST, DELETE` | `api/employee-documents/route.ts` |
| `/api/employee-documents/[id]` | `GET, PATCH, DELETE` | `api/employee-documents/[id]/route.ts` |
| `/api/employee/attendance` | `GET, POST` | `api/employee/attendance/route.ts` |
| `/api/employee/attendance/clock-in` | `POST` | `api/employee/attendance/clock-in/route.ts` |
| `/api/employee/attendance/clock-out` | `POST` | `api/employee/attendance/clock-out/route.ts` |
| `/api/employee/daily-reports` | `GET, POST` | `api/employee/daily-reports/route.ts` |
| `/api/employee/daily-reports/[id]` | `GET, PATCH` | `api/employee/daily-reports/[id]/route.ts` |
| `/api/employee/daily-reports/[id]/attachments` | `GET, POST` | `api/employee/daily-reports/[id]/attachments/route.ts` |
| `/api/employee/daily-reports/[id]/attachments/[attachmentId]` | `GET, PATCH, DELETE` | `api/employee/daily-reports/[id]/attachments/[attachmentId]/route.ts` |
| `/api/employee/leave-requests` | `GET, POST` | `api/employee/leave-requests/route.ts` |
| `/api/employee/scorecard` | `GET` | `api/employee/scorecard/route.ts` |
| `/api/employee/tasks` | `GET` | `api/employee/tasks/route.ts` |
| `/api/employee/tasks/[id]` | `GET, PATCH` | `api/employee/tasks/[id]/route.ts` |
| `/api/employee/tasks/[id]/comments` | `GET, POST, PATCH, DELETE` | `api/employee/tasks/[id]/comments/route.ts` |
| `/api/export` | `POST` | `api/export/route.ts` |
| `/api/feed/posts` | `GET, POST` | `api/feed/posts/route.ts` |
| `/api/feed/posts/[id]/comments` | `GET, POST` | `api/feed/posts/[id]/comments/route.ts` |
| `/api/feed/reactions` | `POST, DELETE` | `api/feed/reactions/route.ts` |
| `/api/knowledge-base-attachments` | `GET, POST` | `api/knowledge-base-attachments/route.ts` |
| `/api/knowledge-base-attachments/[id]` | `GET, PATCH, DELETE` | `api/knowledge-base-attachments/[id]/route.ts` |
| `/api/notification-preferences` | `GET, PATCH` | `api/notification-preferences/route.ts` |
| `/api/notifications` | `GET, POST, PATCH` | `api/notifications/route.ts` |
| `/api/profile` | `GET, PATCH` | `api/profile/route.ts` |
| `/api/profile/avatar` | `POST, DELETE` | `api/profile/avatar/route.ts` |
| `/api/project-documents` | `GET, POST, DELETE` | `api/project-documents/route.ts` |
| `/api/project-documents/[id]` | `GET, PATCH, DELETE` | `api/project-documents/[id]/route.ts` |
| `/api/search` | `GET` | `api/search/route.ts` |
| `/api/settings/organization` | `GET, PATCH` | `api/settings/organization/route.ts` |
| `/api/sops` | `GET, POST` | `api/sops/route.ts` |
| `/api/sops/[id]` | `GET, PATCH, DELETE` | `api/sops/[id]/route.ts` |
| `/api/tasks/[id]/attachments` | `GET, POST` | `api/tasks/[id]/attachments/route.ts` |
| `/api/tasks/[id]/attachments/[attachmentId]` | `GET, PATCH, DELETE` | `api/tasks/[id]/attachments/[attachmentId]/route.ts` |
| `/api/tasks/[id]/checklist` | `GET, POST` | `api/tasks/[id]/checklist/route.ts` |
| `/api/tasks/[id]/checklist/[itemId]` | `PATCH, DELETE` | `api/tasks/[id]/checklist/[itemId]/route.ts` |
| `/api/tasks/[id]/dependencies` | `GET, POST` | `api/tasks/[id]/dependencies/route.ts` |
| `/api/templates` | `GET, POST, DELETE` | `api/templates/route.ts` |
| `/api/templates/[id]` | `GET, PATCH, DELETE` | `api/templates/[id]/route.ts` |
| `/api/time-entries` | `GET, POST` | `api/time-entries/route.ts` |
| `/api/time-entries/[id]` | `PATCH` | `api/time-entries/[id]/route.ts` |

## 5. Validation Schemas Inventory

| Schema Module | Exported Zod Schemas |
| :--- | :--- |
| `batch2.ts` | `teamSchema`, `clientSchema`, `holidaySchema`, `projectMemberSchema`, `scheduleSchema`, `scheduleAssignmentSchema`, `attendanceCorrectionSchema`, `leaveRequestSchema`, `dailyReportSchema` |
| `batch3.ts` | `taskMutationSchema`, `checklistSchema`, `dependencySchema`, `timeEntrySchema` |
| `batch4.ts` | `feedPostSchema`, `feedCommentSchema`, `reactionSchema`, `notificationPreferenceSchema`, `announcementSchema` |

## 6. Mismatches Identified & Remediation

During this audit, the following contract and typing discrepancies were identified and resolved:

1. **Employee Patch Route Contract Mismatch**:
   - *Issue*: `src/app/api/admin/employees/[id]/route.ts` referenced `existing?.status` and `existing?.role_id` directly on the employee object, whereas the contract defines `employment_status` and `profiles.role_id` via the profile relation.
   - *Remediation*: Updated route handler to inspect `existing?.employment_status` and `existing?.profiles?.role_id`.

2. **Activity Log Type Conversion Inconsistency**:
   - *Issue*: `src/lib/db/activity-logs.ts` attempted a direct type cast on joined query data without intermediate casting.
   - *Remediation*: Standardized return type handling to safely cast relational profile joins.

3. **NextResponse Cookie Contract Typing**:
   - *Issue*: `src/types/next.d.ts` lacked `getAll()` and cookie object signature in `NextResponse.cookies`, leading to middleware contract warnings.
   - *Remediation*: Added comprehensive cookie methods conforming to Next.js server conventions.

4. **Automation Schedule Details Helper Contract**:
   - *Issue*: Unit test fixtures expected `localDate` and `timeString` properties alongside `dateStr` and `timeStr`.
   - *Remediation*: Provided dual-property compatibility in `getLocalScheduleDetails` in `src/lib/automation/engine.ts`.

5. **Zod v4 UUID Strictness in Test Fixtures**:
   - *Issue*: Test fixtures in `validation.test.ts` used non-RFC 4122 dummy UUIDs with non-standard variant bits (`11111111-1111-1111-1111-111111111111`), which failed under Zod v4 strict RFC 4122 validation.
   - *Remediation*: Updated test fixtures to use compliant UUID v4 format.

6. **Observability Logger Self-Containment**:
   - *Issue*: Dependency on uninstalled external `pino` package caused build failures and hanging installation attempts.
   - *Remediation*: Built a production-grade, zero-dependency structured logger with automated redaction of sensitive credentials.

## 7. Verification Results

- **Typecheck (`tsc --noEmit`)**: ✅ PASS (0 errors)
- **Unit Tests (`jest tests/unit`)**: ✅ PASS
- **No Phantom Tables or Columns**: ✅ PASS
