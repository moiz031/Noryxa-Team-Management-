-- Make new workspace access requests visible to administrators immediately.
-- The auth trigger creates the pending employee row, and this audit event feeds
-- the existing activity -> notification trigger.

create or replace function public.log_employee_access_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.employment_status::text = 'pending' then
    insert into public.activity_logs (
      actor_id,
      action_type,
      entity_type,
      entity_id,
      metadata,
      source
    ) values (
      new.profile_id,
      'employee.access_requested',
      'employee',
      new.id,
      jsonb_build_object('profile_id', new.profile_id, 'employment_status', new.employment_status::text),
      'auth.signup'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_access_request on public.employees;
create trigger trg_employee_access_request
  after insert on public.employees
  for each row execute function public.log_employee_access_request();

revoke all on function public.log_employee_access_request() from public;
