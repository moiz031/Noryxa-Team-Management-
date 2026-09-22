-- Batch 2 organization operations. Forward-only and additive.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  company_name text,
  email text,
  phone text,
  notes text,
  status text not null default 'lead' check (status in ('lead','active','inactive','archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);
alter table public.projects add column if not exists client_id uuid references public.clients(id) on delete set null;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  department_id uuid references public.departments(id) on delete set null,
  lead_employee_id uuid references public.employees(id) on delete set null,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (team_id, employee_id)
);

create table if not exists public.work_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  monday_start time, monday_end time, tuesday_start time, tuesday_end time,
  wednesday_start time, wednesday_end time, thursday_start time, thursday_end time,
  friday_start time, friday_end time, saturday_start time, saturday_end time,
  sunday_start time, sunday_end time,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id)
);
create table if not exists public.schedule_assignments (
  schedule_id uuid not null references public.work_schedules(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (schedule_id, employee_id, starts_on),
  check (ends_on is null or ends_on >= starts_on)
);
create table if not exists public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  holiday_date date not null unique,
  description text,
  is_company_wide boolean not null default true,
  department_id uuid references public.departments(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  check (is_company_wide or department_id is not null)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'project_members_role_check') then
    alter table public.project_members add constraint project_members_role_check
      check (role in ('owner','manager','member','viewer'));
  end if;
end $$;
create index if not exists teams_department_idx on public.teams(department_id);
create index if not exists team_members_employee_idx on public.team_members(employee_id);
create index if not exists schedule_assignments_employee_idx on public.schedule_assignments(employee_id);
create index if not exists holidays_date_idx on public.holidays(holiday_date);
create index if not exists projects_client_idx on public.projects(client_id);

do $$
declare t text;
begin
  foreach t in array array['clients','teams','work_schedules','holidays'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.clients enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.work_schedules enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.holidays enable row level security;

drop policy if exists clients_read on public.clients;
create policy clients_read on public.clients for select to authenticated using (public.is_admin() or exists (select 1 from public.projects p join public.project_members m on m.project_id=p.id where p.client_id=clients.id and m.employee_id=public.employee_id_for_user()));
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select to authenticated using (public.is_admin() or exists (select 1 from public.team_members tm where tm.team_id=teams.id and tm.employee_id=public.employee_id_for_user()));
drop policy if exists teams_admin_write on public.teams;
create policy teams_admin_write on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists team_members_read on public.team_members;
create policy team_members_read on public.team_members for select to authenticated using (public.is_admin() or employee_id=public.employee_id_for_user());
drop policy if exists team_members_admin_write on public.team_members;
create policy team_members_admin_write on public.team_members for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists schedules_read on public.work_schedules;
create policy schedules_read on public.work_schedules for select to authenticated using (public.is_admin() or exists (select 1 from public.schedule_assignments sa where sa.schedule_id=work_schedules.id and sa.employee_id=public.employee_id_for_user()));
drop policy if exists schedules_admin_write on public.work_schedules;
create policy schedules_admin_write on public.work_schedules for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists assignments_read on public.schedule_assignments;
create policy assignments_read on public.schedule_assignments for select to authenticated using (public.is_admin() or employee_id=public.employee_id_for_user());
drop policy if exists assignments_admin_write on public.schedule_assignments;
create policy assignments_admin_write on public.schedule_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays for select to authenticated using (public.is_admin() or is_company_wide or exists (select 1 from public.employees e where e.id=public.employee_id_for_user() and e.department_id=holidays.department_id));
drop policy if exists holidays_admin_write on public.holidays;
create policy holidays_admin_write on public.holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.can_manage_project_members(target_project uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select public.is_admin() or exists (select 1 from public.project_members pm where pm.project_id=target_project and pm.employee_id=public.employee_id_for_user() and pm.role in ('owner','manager')) $$;
drop policy if exists project_members_admin_write on public.project_members;
create policy project_members_admin_write on public.project_members for all to authenticated using (public.can_manage_project_members(project_id)) with check (public.can_manage_project_members(project_id));
drop policy if exists tasks_project_member_update on public.tasks;
create policy tasks_project_member_update on public.tasks for update to authenticated using (public.is_admin() or assigned_to=public.employee_id_for_user() or exists (select 1 from public.project_members pm where pm.project_id=tasks.project_id and pm.employee_id=public.employee_id_for_user() and pm.role in ('owner','manager','member'))) with check (public.is_admin() or assigned_to=public.employee_id_for_user() or exists (select 1 from public.project_members pm where pm.project_id=tasks.project_id and pm.employee_id=public.employee_id_for_user() and pm.role in ('owner','manager','member')));
