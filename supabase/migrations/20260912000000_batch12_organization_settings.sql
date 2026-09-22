-- Batch 12: Organization Settings, Role Settings, User Preferences
-- Additive migration only. No destructive changes.

-- ============================================================
-- Organization-level settings
-- ============================================================
create table if not exists public.organization_settings (
  id                          uuid primary key default gen_random_uuid(),
  organization_name           text not null default 'My Organization',
  timezone                    text not null default 'UTC',
  default_work_week           text[] not null default array['monday','tuesday','wednesday','thursday','friday'],
  default_work_start_time     time not null default '09:00:00',
  default_work_end_time       time not null default '18:00:00',
  max_file_upload_mb          integer not null default 25 check (max_file_upload_mb between 1 and 500),
  default_leave_days_per_year integer not null default 20 check (default_leave_days_per_year >= 0),
  allow_employee_feed_post    boolean not null default true,
  allow_employee_comment      boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Only one row for the entire deployment (singleton pattern)
create unique index if not exists organization_settings_singleton
  on public.organization_settings ((true));

-- Seed default settings row if not already present
insert into public.organization_settings (organization_name)
select 'My Organization'
where not exists (select 1 from public.organization_settings);

-- ============================================================
-- User notification preferences
-- ============================================================
create table if not exists public.user_notification_preferences (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references public.profiles(id) on delete cascade,
  notify_task_assigned    boolean not null default true,
  notify_task_overdue     boolean not null default true,
  notify_leave_status     boolean not null default true,
  notify_mention          boolean not null default true,
  notify_comment_reply    boolean not null default true,
  notify_announcement     boolean not null default true,
  notify_report_reviewed  boolean not null default true,
  notify_team_change      boolean not null default true,
  email_notifications     boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (profile_id)
);

-- ============================================================
-- User profile preferences (timezone, display, etc.)
-- ============================================================
alter table public.profiles
  add column if not exists display_timezone   text default 'UTC',
  add column if not exists display_language   text default 'en',
  add column if not exists theme_preference   text default 'system' check (theme_preference in ('light','dark','system'));

-- ============================================================
-- updated_at auto-update triggers
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_organization_settings_updated_at on public.organization_settings;
create trigger trg_organization_settings_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_notification_prefs_updated_at on public.user_notification_preferences;
create trigger trg_user_notification_prefs_updated_at
  before update on public.user_notification_preferences
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS policies
-- ============================================================

-- Organization settings: admin can read/update; employees can read
alter table public.organization_settings enable row level security;

drop policy if exists "org_settings_admin_all" on public.organization_settings;
create policy "org_settings_admin_all"
  on public.organization_settings
  for all
  using (
    public.is_admin()
    and exists (
      select 1 from public.employees e
      where e.profile_id = auth.uid()
        and e.employment_status = 'active'
    )
  )
  with check (
    public.is_admin()
    and exists (
      select 1 from public.employees e
      where e.profile_id = auth.uid()
        and e.employment_status = 'active'
    )
  );

drop policy if exists "org_settings_employee_read" on public.organization_settings;
create policy "org_settings_employee_read"
  on public.organization_settings
  for select
  using (
    exists (
      select 1 from public.employees e
      where e.profile_id = auth.uid()
        and e.employment_status = 'active'
    )
  );

-- User notification preferences: each user manages their own
alter table public.user_notification_preferences enable row level security;

drop policy if exists "notif_prefs_own" on public.user_notification_preferences;
create policy "notif_prefs_own"
  on public.user_notification_preferences
  for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Admin can read all preferences (for admin visibility, not edit)
drop policy if exists "notif_prefs_admin_read" on public.user_notification_preferences;
create policy "notif_prefs_admin_read"
  on public.user_notification_preferences
  for select
  using (
    public.is_admin()
    and exists (
      select 1 from public.employees e
      where e.profile_id = auth.uid()
        and e.employment_status = 'active'
    )
  );

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_user_notif_prefs_profile_id
  on public.user_notification_preferences(profile_id);
