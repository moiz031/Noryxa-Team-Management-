-- Forward-only operating-system foundation.  All objects are additive and safe
-- to apply after the Phase 1/2 authentication migrations.

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role text not null default 'member',
  added_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, employee_id)
);

create index if not exists project_members_employee_idx on public.project_members(employee_id);
alter table public.project_members enable row level security;

drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated
  using (public.is_admin() or employee_id = public.employee_id_for_user()
    or exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid()));
drop policy if exists project_members_admin_write on public.project_members;
create policy project_members_admin_write on public.project_members for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Membership is an additional visibility path; existing creator/assignee access
-- remains unchanged.
drop policy if exists projects_member_read on public.projects;
create policy projects_member_read on public.projects for select to authenticated
  using (exists (select 1 from public.project_members m
    where m.project_id = projects.id and m.employee_id = public.employee_id_for_user()));
drop policy if exists tasks_project_member_read on public.tasks;
create policy tasks_project_member_read on public.tasks for select to authenticated
  using (exists (select 1 from public.project_members m
    where m.project_id = tasks.project_id and m.employee_id = public.employee_id_for_user()));

-- Secure object access by checking the metadata row, not only owner_id.
drop policy if exists task_files_read on storage.objects;
create policy task_files_read on storage.objects for select to authenticated using (
  bucket_id = 'task-attachments' and (
    public.is_admin() or owner_id = auth.uid()::text or exists (
      select 1 from public.task_attachments a
      join public.tasks t on t.id = a.task_id
      where a.storage_path = name and (t.assigned_to = public.employee_id_for_user()
        or t.created_by = auth.uid()
        or exists (select 1 from public.project_members m
          where m.project_id = t.project_id and m.employee_id = public.employee_id_for_user()))
    )
  )
);
drop policy if exists task_files_write on storage.objects;
create policy task_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'task-attachments' and owner_id = auth.uid()::text
  and exists (select 1 from public.task_attachments a join public.tasks t on t.id = a.task_id
    where a.storage_path = name and (t.assigned_to = public.employee_id_for_user()
      or t.created_by = auth.uid() or public.is_admin()))
);

-- Server-side aggregate foundation for command-center dashboards.
create or replace view public.command_center_metrics
with (security_invoker = true) as
select
  (select count(*) from public.employees where employment_status = 'active')::integer as active_employees,
  (select count(*) from public.projects where status = 'active')::integer as active_projects,
  (select count(*) from public.tasks where status not in ('completed', 'cancelled'))::integer as open_tasks,
  (select count(*) from public.leave_requests where status = 'pending')::integer as pending_leave_requests,
  (select count(*) from public.daily_reports where status = 'submitted')::integer as pending_reports,
  (select count(*) from public.notifications where read_at is null and recipient_id = auth.uid())::integer as unread_notifications;

grant select on public.command_center_metrics to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.project_members;
  end if;
exception when duplicate_object then null;
end $$;
