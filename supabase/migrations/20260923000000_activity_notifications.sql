-- Batch 25: turn audited work into user-visible activity notifications.
-- Admins receive the organization activity stream; employees receive a
-- notification for their own recorded activity. Existing targeted
-- notifications remain the source for assignments, approvals, mentions, etc.

-- Allow the profiles -> activity_logs ON DELETE SET NULL cascade to work while
-- keeping ordinary audit updates/deletes immutable.
create or replace function public.prevent_activity_logs_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and current_setting('app.allow_audit_archive', true) = 'on' then
    return old;
  end if;
  if tg_op = 'UPDATE' and old.actor_id is not null and new.actor_id is null then
    return new;
  end if;
  raise exception 'Audit log records are immutable and cannot be updated or deleted (operation: %)', tg_op
    using errcode = '55000';
end;
$$;

create or replace function public.notify_activity_recipients()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient uuid;
  activity_label text;
begin
  -- A notification already creates its own audit event. Do not notify again
  -- for that bookkeeping event or every user would receive duplicates.
  if new.action_type in ('notification.generated', 'activity.viewed') then
    return new;
  end if;

  activity_label := initcap(replace(replace(new.action_type, '.', ' '), '_', ' '));

  begin
    for recipient in
      select p.id
      from public.profiles p
      join public.roles r on r.id = p.role_id
      where p.is_active
        and (r.code = 'admin' or p.id = new.actor_id)
    loop
      insert into public.notifications (
        recipient_id,
        actor_id,
        type,
        title,
        body,
        entity_type,
        entity_id,
        metadata,
        dedupe_key
      ) values (
        recipient,
        new.actor_id,
        'activity',
        'New activity: ' || activity_label,
        coalesce(initcap(replace(new.entity_type, '_', ' ')) || ' activity was recorded.', 'A new activity was recorded.'),
        new.entity_type,
        new.entity_id,
        jsonb_build_object('activity_log_id', new.id, 'source', coalesce(new.source, 'system')),
        'activity:' || new.id::text || ':' || recipient::text
      );
    end loop;
  exception when others then
    -- Never make the primary audit write fail because notification delivery
    -- is temporarily unavailable.
    raise warning 'Activity notification delivery failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_activity_log_notifications on public.activity_logs;
create trigger trg_activity_log_notifications
  after insert on public.activity_logs
  for each row execute function public.notify_activity_recipients();
