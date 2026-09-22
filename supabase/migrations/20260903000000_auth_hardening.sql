-- Forward-only authentication hardening. This migration does not reset data,
-- disable RLS, or remove existing objects.

-- Never allow the organization to accidentally remove its last administrator.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_role_id uuid;
  admin_count integer;
begin
  select id into admin_role_id from public.roles where code = 'admin';
  if old.role_id = admin_role_id and (
    (tg_op = 'DELETE') or
    (tg_op = 'UPDATE' and (new.role_id is distinct from old.role_id or new.is_active is distinct from old.is_active))
  ) then
    select count(*) into admin_count from public.profiles
      where role_id = admin_role_id and is_active and id <> old.id;
    if admin_count = 0 then
      raise exception 'The last active administrator cannot be removed or deactivated';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'prevent_last_admin_removal') then
    create trigger prevent_last_admin_removal
      before update or delete on public.profiles
      for each row execute function public.prevent_last_admin_removal();
  end if;
end;
$$;

comment on function public.prevent_last_admin_removal() is
  'Preserves at least one active administrator during account maintenance.';
