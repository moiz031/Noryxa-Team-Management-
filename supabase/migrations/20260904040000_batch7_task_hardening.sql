-- Trigger to restrict task status transitions based on dependencies
create or replace function public.check_task_status_transition()
returns trigger language plpgsql set search_path = public as $$
begin
  if (new.status = 'completed' or new.status = 'in_progress') and (old.status != new.status) then
    if exists (
      select 1 from public.task_dependencies td
      join public.tasks t on t.id = td.depends_on_task_id
      where td.task_id = new.id and t.status != 'completed'
    ) then
      raise exception 'Cannot transition task status. Not all dependencies are completed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_task_status_transition_trg on public.tasks;
create trigger check_task_status_transition_trg
before update on public.tasks
for each row execute function public.check_task_status_transition();

-- Update time_entries_read policy to allow project members to view time entries on tasks they can access
drop policy if exists time_entries_read on public.time_entries;
create policy time_entries_read on public.time_entries for select to authenticated using (
  public.is_admin() 
  or employee_id = public.employee_id_for_user()
  or exists (
    select 1 from public.tasks t 
    where t.id = task_id and (
      exists (
        select 1 from public.project_members m 
        where m.project_id = t.project_id and m.employee_id = public.employee_id_for_user()
      )
    )
  )
);
