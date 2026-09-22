-- Analytics foundation: bounded, RLS-aware aggregate reads only.
create index if not exists tasks_created_at_idx on public.tasks(created_at);
create index if not exists daily_reports_date_idx on public.daily_reports(report_date);
create index if not exists time_entries_started_at_idx on public.time_entries(started_at);

create or replace function public.get_analytics_summary(
  p_start_date date default (current_date - 30),
  p_end_date date default current_date,
  p_employee_id uuid default null
)
returns table (
  total_tasks bigint,
  completed_tasks bigint,
  overdue_tasks bigint,
  attendance_days bigint,
  present_days bigint,
  absent_days bigint,
  report_count bigint,
  submitted_report_count bigint,
  tracked_seconds bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_is_admin boolean;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid analytics date range';
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'Analytics date range cannot exceed 366 days';
  end if;

  v_is_admin := public.is_admin();
  v_employee_id := public.employee_id_for_user();
  if not v_is_admin and (v_employee_id is null or (p_employee_id is not null and p_employee_id <> v_employee_id)) then
    raise exception 'Analytics scope is not permitted';
  end if;
  if not v_is_admin then
    p_employee_id := v_employee_id;
  end if;

  return query
  select
    (select count(*) from public.tasks t
      where t.created_at::date between p_start_date and p_end_date
        and (p_employee_id is null or t.assigned_to = p_employee_id)),
    (select count(*) from public.tasks t
      where t.completed_at::date between p_start_date and p_end_date
        and t.status = 'completed'
        and (p_employee_id is null or t.assigned_to = p_employee_id)),
    (select count(*) from public.tasks t
      where t.due_date between p_start_date and p_end_date
        and t.due_date < current_date
        and t.status not in ('completed', 'cancelled')
        and (p_employee_id is null or t.assigned_to = p_employee_id)),
    (select count(*) from public.attendance a
      where a.attendance_date between p_start_date and p_end_date
        and (p_employee_id is null or a.employee_id = p_employee_id)),
    (select count(*) from public.attendance a
      where a.attendance_date between p_start_date and p_end_date
        and a.status in ('present', 'late', 'remote')
        and (p_employee_id is null or a.employee_id = p_employee_id)),
    (select count(*) from public.attendance a
      where a.attendance_date between p_start_date and p_end_date
        and a.status = 'absent'
        and (p_employee_id is null or a.employee_id = p_employee_id)),
    (select count(*) from public.daily_reports r
      where r.report_date between p_start_date and p_end_date
        and (p_employee_id is null or r.employee_id = p_employee_id)),
    (select count(*) from public.daily_reports r
      where r.report_date between p_start_date and p_end_date
        and r.status in ('submitted', 'reviewed')
        and (p_employee_id is null or r.employee_id = p_employee_id)),
    coalesce((select sum(coalesce(te.duration_seconds, 0)) from public.time_entries te
      where te.started_at::date between p_start_date and p_end_date
        and (p_employee_id is null or te.employee_id = p_employee_id)), 0);
end;
$$;

revoke all on function public.get_analytics_summary(date, date, uuid) from public;
grant execute on function public.get_analytics_summary(date, date, uuid) to authenticated;
