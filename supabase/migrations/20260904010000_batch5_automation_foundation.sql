-- Batch 5 automation foundation. Forward-only and additive.
-- Jobs are claimed with a unique idempotency key so concurrent workers cannot
-- execute the same daily automation window more than once.
create table if not exists public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('overdue_task_notifications', 'missing_daily_report_reminders')),
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists automation_jobs_status_created_idx
  on public.automation_jobs(status, created_at);

drop trigger if exists automation_jobs_updated_at on public.automation_jobs;
create trigger automation_jobs_updated_at
before update on public.automation_jobs
for each row execute function public.set_updated_at();

alter table public.automation_jobs enable row level security;
-- No client-facing policy: automation jobs are server-only and accessed with
-- the service-role client from a protected server route.
