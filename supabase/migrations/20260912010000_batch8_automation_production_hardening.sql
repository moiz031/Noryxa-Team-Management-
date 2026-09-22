-- Batch 8: Automation Engine Production Hardening
-- Adds recurring task tracking columns to tasks and expands automation_jobs check constraints.

-- 1. Add recurrence columns to tasks if not exist
alter table public.tasks 
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_interval text check (recurrence_interval in ('daily', 'weekly', 'monthly')),
  add column if not exists next_recurrence_at timestamptz,
  add column if not exists last_recurrence_at timestamptz;

-- 2. Update automation_jobs constraints to support pending, processing, running, completed, failed, retry
alter table public.automation_jobs drop constraint if exists automation_jobs_status_check;
alter table public.automation_jobs add constraint automation_jobs_status_check 
  check (status in ('pending', 'processing', 'running', 'completed', 'failed', 'retry'));

alter table public.automation_jobs drop constraint if exists automation_jobs_job_type_check;
alter table public.automation_jobs add constraint automation_jobs_job_type_check 
  check (job_type in (
    'overdue_task_notifications',
    'missing_daily_report_reminders',
    'leave_aware_report_suppression',
    'onboarding_check',
    'recurring_tasks_generation',
    'late_attendance_detection',
    'notification_generation'
  ));

create index if not exists tasks_recurring_idx on public.tasks(is_recurring, next_recurrence_at) where is_recurring = true;
