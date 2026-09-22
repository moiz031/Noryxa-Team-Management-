-- Batch 19: Harden Global Audit Log
-- 1. Extend activity_logs with forensics columns (source, ip_address, org_context)
-- 2. Append-only trigger preventing UPDATE or DELETE on activity_logs
-- 3. Compliant archival table activity_logs_archive and admin archival function archive_old_audit_logs()
-- 4. Overload/upgrade public.log_activity() to support forensic context while preserving backwards compatibility
-- 5. Performance and query indexes for audit searches

-- 1. Extend activity_logs schema
alter table public.activity_logs
  add column if not exists source text default 'api',
  add column if not exists ip_address inet default null,
  add column if not exists org_context jsonb not null default '{}'::jsonb;

-- Indexes for efficient audit filtering
create index if not exists activity_logs_source_created_idx
  on public.activity_logs (source, created_at desc);

create index if not exists activity_logs_action_type_created_idx
  on public.activity_logs (action_type, created_at desc);

-- 2. Append-only trigger function to enforce immutability
create or replace function public.prevent_activity_logs_mutation()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Only allow deletion if the internal session variable is set (used exclusively by the archive function)
  if tg_op = 'DELETE' and current_setting('app.allow_audit_archive', true) = 'on' then
    return old;
  end if;

  raise exception 'Audit log records are immutable and cannot be updated or deleted (operation: %)', tg_op
    using errcode = '55000';
end;
$$;

drop trigger if exists trg_activity_logs_immutable on public.activity_logs;
create trigger trg_activity_logs_immutable
  before update or delete on public.activity_logs
  for each row
  execute function public.prevent_activity_logs_mutation();

-- 3. Archive table for compliance retention
create table if not exists public.activity_logs_archive (
  like public.activity_logs including all
);

alter table public.activity_logs_archive enable row level security;

-- Admin read-only policy for archive
drop policy if exists activity_logs_archive_admin_read on public.activity_logs_archive;
create policy activity_logs_archive_admin_read on public.activity_logs_archive
  for select to authenticated using (public.is_admin());

-- Immutable trigger for archive table as well
drop trigger if exists trg_activity_logs_archive_immutable on public.activity_logs_archive;
create trigger trg_activity_logs_archive_immutable
  before update or delete on public.activity_logs_archive
  for each row
  execute function public.prevent_activity_logs_mutation();

-- 4. Archival procedure (admin only)
create or replace function public.archive_old_audit_logs(p_days_retention integer default 90)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived_count integer := 0;
  v_cutoff timestamptz;
begin
  -- Verify caller is admin (or background system caller where auth.uid() is null in trusted contexts)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Only administrators can trigger audit log archival';
  end if;

  if p_days_retention < 30 then
    raise exception 'Retention period must be at least 30 days';
  end if;

  v_cutoff := timezone('utc', now()) - (p_days_retention || ' days')::interval;

  -- Temporarily allow deletion within this transaction
  perform set_config('app.allow_audit_archive', 'on', true);

  with moved_rows as (
    delete from public.activity_logs
    where created_at < v_cutoff
    returning *
  )
  insert into public.activity_logs_archive
  select * from moved_rows;

  get diagnostics v_archived_count = row_count;
  return v_archived_count;
end;
$$;

grant execute on function public.archive_old_audit_logs(integer) to authenticated;

-- 5. Upgrade public.log_activity to support extended forensic fields
create or replace function public.log_activity(
  p_action_type text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb,
  p_source text default 'api',
  p_ip_address inet default null,
  p_org_context jsonb default '{}'::jsonb
) returns public.activity_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  result public.activity_logs;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  insert into public.activity_logs (
    actor_id,
    action_type,
    entity_type,
    entity_id,
    metadata,
    source,
    ip_address,
    org_context
  ) values (
    auth.uid(),
    p_action_type,
    p_entity_type,
    p_entity_id,
    coalesce(p_metadata, '{}'::jsonb),
    coalesce(p_source, 'api'),
    p_ip_address,
    coalesce(p_org_context, '{}'::jsonb)
  ) returning * into result;

  return result;
end;
$$;

grant execute on function public.log_activity(text, text, uuid, jsonb, text, inet, jsonb) to authenticated;
