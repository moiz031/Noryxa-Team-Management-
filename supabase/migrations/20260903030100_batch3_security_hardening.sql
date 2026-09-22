-- Batch 3 security hardening: bind child records to authorized task access.
create or replace function public.can_access_task(target_task uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.tasks t
      where t.id = target_task
        and (
          t.created_by = auth.uid()
          or t.assigned_to = public.employee_id_for_user()
          or exists (
            select 1
            from public.project_members pm
            where pm.project_id = t.project_id
              and pm.employee_id = public.employee_id_for_user()
          )
        )
    );
$$;

grant execute on function public.can_access_task(uuid) to authenticated;

drop policy if exists checklist_read on public.task_checklist_items;
create policy checklist_read on public.task_checklist_items
for select to authenticated
using (public.can_access_task(task_id));

drop policy if exists checklist_write on public.task_checklist_items;
create policy checklist_insert on public.task_checklist_items
for insert to authenticated
with check (public.can_access_task(task_id) and (public.is_admin() or created_by = auth.uid()));

create policy checklist_update on public.task_checklist_items
for update to authenticated
using (public.can_access_task(task_id) and (public.is_admin() or created_by = auth.uid()))
with check (public.can_access_task(task_id) and (public.is_admin() or created_by = auth.uid()));

create policy checklist_delete on public.task_checklist_items
for delete to authenticated
using (public.can_access_task(task_id) and (public.is_admin() or created_by = auth.uid()));

drop policy if exists dependencies_read on public.task_dependencies;
create policy dependencies_read on public.task_dependencies
for select to authenticated
using (public.can_access_task(task_id) and public.can_access_task(depends_on_task_id));

drop policy if exists dependencies_write on public.task_dependencies;
create policy dependencies_insert on public.task_dependencies
for insert to authenticated
with check (
  public.can_access_task(task_id)
  and public.can_access_task(depends_on_task_id)
  and (public.is_admin() or created_by = auth.uid())
);

create policy dependencies_delete on public.task_dependencies
for delete to authenticated
using (public.is_admin() or (created_by = auth.uid() and public.can_access_task(task_id)));

drop policy if exists task_attachments_read on public.task_attachments;
create policy task_attachments_read on public.task_attachments
for select to authenticated
using (public.can_access_task(task_id));

drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments
for delete to authenticated
using (public.can_access_task(task_id) and (public.is_admin() or uploaded_by = auth.uid()));
