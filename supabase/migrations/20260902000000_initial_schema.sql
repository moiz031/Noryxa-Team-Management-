-- Phase 1 foundation for Agency OS.
-- Apply with Supabase migrations. RLS is enabled below; do not remove it for local development.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'employee');
create type public.employee_status as enum ('active', 'inactive', 'on_leave', 'invited');
create type public.task_status as enum ('backlog', 'todo', 'in_progress', 'blocked', 'review', 'completed', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.report_status as enum ('draft', 'submitted', 'reviewed');
create type public.attendance_status as enum ('present', 'late', 'absent', 'half_day', 'remote', 'excused');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.announcement_audience as enum ('all', 'department');

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code public.app_role not null unique,
  name text not null,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

insert into public.roles (code, name, permissions) values
  ('admin', 'Administrator', '{"scope":"organization"}'::jsonb),
  ('employee', 'Employee', '{"scope":"self"}'::jsonb)
on conflict (code) do nothing;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  full_name text,
  avatar_path text,
  phone text,
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id)
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  employee_code text unique,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  job_title text,
  joined_on date,
  employment_status public.employee_status not null default 'invited',
  emergency_contact jsonb,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  client_name text,
  status public.project_status not null default 'planning',
  department_id uuid references public.departments(id) on delete set null,
  starts_on date,
  due_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'backlog',
  priority public.task_priority not null default 'medium',
  assigned_to uuid references public.employees(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id)
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id)
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  report_date date not null,
  status public.report_status not null default 'draft',
  summary text not null,
  blockers text,
  tomorrow_plan text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (employee_id, report_date)
);

create table public.daily_report_attachments (
  id uuid primary key default gen_random_uuid(),
  daily_report_id uuid not null references public.daily_reports(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  attendance_date date not null,
  status public.attendance_status not null default 'present',
  check_in_at timestamptz,
  check_out_at timestamptz,
  note text,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  unique (employee_id, attendance_date)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null,
  starts_on date not null,
  ends_on date not null,
  reason text,
  status public.leave_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  constraint leave_dates_valid check (ends_on >= starts_on)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience public.announcement_audience not null default 'all',
  department_id uuid references public.departments(id) on delete set null,
  published_at timestamptz,
  expires_at timestamptz,
  is_pinned boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  constraint department_audience_has_department check (audience = 'all' or department_id is not null)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  owner_id uuid references public.employees(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by uuid references public.profiles(id)
);

create index employees_department_idx on public.employees (department_id);
create index employees_manager_idx on public.employees (manager_id);
create index projects_status_idx on public.projects (status);
create index tasks_assigned_status_idx on public.tasks (assigned_to, status);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_due_at_idx on public.tasks (due_at);
create index comments_task_created_idx on public.task_comments (task_id, created_at desc);
create index reports_employee_date_idx on public.daily_reports (employee_id, report_date desc);
create index attendance_date_idx on public.attendance (attendance_date desc);
create index leave_employee_status_idx on public.leave_requests (employee_id, status);
create index announcements_published_idx on public.announcements (published_at desc);
create index notifications_recipient_read_idx on public.notifications (recipient_id, read_at, created_at desc);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id, created_at desc);
create index documents_owner_department_idx on public.documents (owner_id, department_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = timezone('utc', now()); return new; end;
$$;

do $$ declare table_name text; begin
  foreach table_name in array array['roles','profiles','departments','employees','projects','tasks','task_comments','daily_reports','daily_report_attachments','attendance','leave_requests','announcements','documents'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', table_name || '_updated_at', table_name);
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, role_id, full_name)
  values (new.id, (select id from public.roles where code = 'employee'), coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p join public.roles r on r.id = p.role_id where p.id = auth.uid() and p.is_active and r.code = 'admin');
$$;

create or replace function public.employee_id_for_user(user_id uuid default auth.uid())
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.employees where profile_id = user_id limit 1;
$$;

create or replace function public.log_activity(
  p_action_type text, p_entity_type text default null, p_entity_id uuid default null, p_metadata jsonb default '{}'::jsonb
) returns public.activity_logs language plpgsql security definer set search_path = public as $$
declare result public.activity_logs;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.activity_logs (actor_id, action_type, entity_type, entity_id, metadata)
  values (auth.uid(), p_action_type, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb)) returning * into result;
  return result;
end;
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.employee_id_for_user(uuid) to authenticated;
grant execute on function public.log_activity(text, text, uuid, jsonb) to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_attachments enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_attachments enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;
alter table public.documents enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);
create policy roles_admin_write on public.roles for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create policy departments_read on public.departments for select to authenticated using (true);
create policy departments_admin_write on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy employees_read on public.employees for select to authenticated using (profile_id = auth.uid() or public.is_admin());
create policy employees_admin_write on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy projects_read on public.projects for select to authenticated using (public.is_admin() or created_by = auth.uid() or exists (select 1 from public.tasks t where t.project_id = projects.id and t.assigned_to = public.employee_id_for_user()));
create policy projects_admin_write on public.projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy tasks_read on public.tasks for select to authenticated using (public.is_admin() or created_by = auth.uid() or assigned_to = public.employee_id_for_user());
create policy tasks_admin_write on public.tasks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy tasks_employee_update on public.tasks for update to authenticated using (assigned_to = public.employee_id_for_user()) with check (assigned_to = public.employee_id_for_user());

create policy task_comments_read on public.task_comments for select to authenticated using (public.is_admin() or author_id = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and (t.assigned_to = public.employee_id_for_user() or t.created_by = auth.uid())));
create policy task_comments_write on public.task_comments for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and (t.assigned_to = public.employee_id_for_user() or t.created_by = auth.uid() or public.is_admin())));
create policy task_comments_update on public.task_comments for update to authenticated using (author_id = auth.uid() or public.is_admin()) with check (author_id = auth.uid() or public.is_admin());

create policy task_attachments_read on public.task_attachments for select to authenticated using (public.is_admin() or uploaded_by = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and t.assigned_to = public.employee_id_for_user()));
create policy task_attachments_write on public.task_attachments for insert to authenticated with check (uploaded_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and (t.assigned_to = public.employee_id_for_user() or t.created_by = auth.uid() or public.is_admin())));

create policy reports_read on public.daily_reports for select to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user());
create policy reports_write on public.daily_reports for all to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user()) with check (public.is_admin() or (employee_id = public.employee_id_for_user() and created_by = auth.uid()));
create policy report_attachments_read on public.daily_report_attachments for select to authenticated using (public.is_admin() or uploaded_by = auth.uid() or exists (select 1 from public.daily_reports r where r.id = daily_report_id and r.employee_id = public.employee_id_for_user()));
create policy report_attachments_write on public.daily_report_attachments for insert to authenticated with check (uploaded_by = auth.uid() and exists (select 1 from public.daily_reports r where r.id = daily_report_id and r.employee_id = public.employee_id_for_user()));

create policy attendance_read on public.attendance for select to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user());
create policy attendance_write on public.attendance for all to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user()) with check (public.is_admin() or (employee_id = public.employee_id_for_user() and created_by = auth.uid()));

create policy leave_read on public.leave_requests for select to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user());
create policy leave_write on public.leave_requests for all to authenticated using (public.is_admin() or employee_id = public.employee_id_for_user()) with check (public.is_admin() or (employee_id = public.employee_id_for_user() and created_by = auth.uid()));

create policy announcements_read on public.announcements for select to authenticated using (public.is_admin() or audience = 'all' or department_id = (select e.department_id from public.employees e where e.profile_id = auth.uid()));
create policy announcements_admin_write on public.announcements for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy notifications_read on public.notifications for select to authenticated using (recipient_id = auth.uid() or public.is_admin());
create policy notifications_update on public.notifications for update to authenticated using (recipient_id = auth.uid() or public.is_admin()) with check (recipient_id = auth.uid() or public.is_admin());

create policy activity_logs_admin_read on public.activity_logs for select to authenticated using (public.is_admin());
-- Inserts happen through log_activity(), which prevents spoofing actor_id and is not exposed as a table insert.

create policy documents_read on public.documents for select to authenticated using (public.is_admin() or uploaded_by = auth.uid() or owner_id = public.employee_id_for_user() or department_id = (select e.department_id from public.employees e where e.profile_id = auth.uid()));
create policy documents_write on public.documents for all to authenticated using (public.is_admin() or uploaded_by = auth.uid()) with check (public.is_admin() or uploaded_by = auth.uid());

-- Private buckets. Object paths are intentionally scoped: {profile_id}/..., {task_id}/..., or {report_id}/....
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', false),
  ('task-attachments', 'task-attachments', false),
  ('documents', 'documents', false),
  ('daily-report-attachments', 'daily-report-attachments', false)
on conflict (id) do update set public = excluded.public;

create policy avatars_read on storage.objects for select to authenticated using (bucket_id = 'avatars' and (owner_id = auth.uid()::text or public.is_admin()));
create policy avatars_write on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (owner_id = auth.uid()::text or public.is_admin()));

create policy task_files_read on storage.objects for select to authenticated using (bucket_id = 'task-attachments' and (public.is_admin() or owner_id = auth.uid()::text));
create policy task_files_write on storage.objects for insert to authenticated with check (bucket_id = 'task-attachments' and owner_id = auth.uid()::text);

create policy documents_files_read on storage.objects for select to authenticated using (bucket_id = 'documents' and (public.is_admin() or owner_id = auth.uid()::text));
create policy documents_files_write on storage.objects for insert to authenticated with check (bucket_id = 'documents' and owner_id = auth.uid()::text);

create policy report_files_read on storage.objects for select to authenticated using (bucket_id = 'daily-report-attachments' and (public.is_admin() or owner_id = auth.uid()::text));
create policy report_files_write on storage.objects for insert to authenticated with check (bucket_id = 'daily-report-attachments' and owner_id = auth.uid()::text);

-- Opt operational tables into Supabase Realtime when the managed publication exists.
do $$ declare relation_name regclass; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array[
      'public.activity_logs'::regclass, 'public.notifications'::regclass, 'public.tasks'::regclass,
      'public.announcements'::regclass, 'public.attendance'::regclass, 'public.daily_reports'::regclass
    ] loop
      if not exists (select 1 from pg_publication_rel pr join pg_publication p on p.oid = pr.prpubid where p.pubname = 'supabase_realtime' and pr.prrelid = relation_name) then
        execute format('alter publication supabase_realtime add table %s', relation_name);
      end if;
    end loop;
  end if;
end $$;
