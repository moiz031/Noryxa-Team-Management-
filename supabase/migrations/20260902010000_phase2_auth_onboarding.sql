-- Phase 2 additive migration. Do not edit the Phase 1 migration after it is applied.

-- Keep email synchronized from Auth and make the employee lifecycle explicit.
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;
create unique index if not exists profiles_email_unique_idx on public.profiles (lower(email)) where email is not null;

create type public.employee_status_v2 as enum ('pending', 'active', 'suspended', 'inactive');
alter table public.employees alter column employment_status drop default;
alter table public.employees alter column employment_status type public.employee_status_v2 using (
  case employment_status::text when 'invited' then 'pending' when 'on_leave' then 'active' else employment_status::text end::public.employee_status_v2
);
drop type public.employee_status;
alter type public.employee_status_v2 rename to employee_status;
alter table public.employees alter column employment_status set default 'pending'::public.employee_status;

-- Backfill the trusted employee row for Auth users that existed before Phase 2.
insert into public.employees (profile_id, employment_status)
select p.id, 'pending'::public.employee_status
from public.profiles p
left join public.employees e on e.profile_id = p.id
where e.id is null;

-- Auth signup/invite is the only trusted path that creates the base employee row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare employee_role_id uuid;
begin
  select id into employee_role_id from public.roles where code = 'employee';
  insert into public.profiles (id, role_id, email, full_name)
  values (new.id, employee_role_id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do update set email = excluded.email;
  insert into public.employees (profile_id, employment_status)
  values (new.id, 'pending')
  on conflict (profile_id) do nothing;
  return new;
end;
$$;

-- Employees may edit safe profile fields but cannot alter their own role or active state.
create or replace function public.prevent_employee_privilege_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() = old.id and not public.is_admin() and (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active) then
    raise exception 'Only an administrator can change role or account state';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_employee_privilege_change on public.profiles;
create trigger prevent_employee_privilege_change
before update on public.profiles for each row execute function public.prevent_employee_privilege_change();

-- Only administrators can create or change employee records through the data API.
drop policy if exists employees_admin_write on public.employees;
create policy employees_admin_write on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Explicitly retain self-read and admin-read semantics after the additive migration.
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees for select to authenticated using (profile_id = auth.uid() or public.is_admin());

comment on function public.handle_new_user() is 'Trusted Auth trigger: creates least-privileged employee profile and pending employee row.';
comment on function public.prevent_employee_privilege_change() is 'Prevents non-admin users from changing role_id or is_active.';
