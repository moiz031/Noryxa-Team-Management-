-- Additive migration: Fix RLS recursion between projects and project_members
-- and harden documents and report storage policies with entity-backed relational checks.

-- 1. Security-definer helper functions to avoid recursive policy evaluation
create or replace function public.is_project_creator(target_project uuid, user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.projects
    where id = target_project and created_by = user_id
  );
$$;

create or replace function public.is_project_member(target_project uuid, emp_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_members
    where project_id = target_project and employee_id = emp_id
  );
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_admin() or exists (
    select 1 from public.project_members pm
    where pm.project_id = target_project
      and pm.employee_id = public.employee_id_for_user()
  );
$$;

-- 2. Refine project_members and projects select policies using helper functions
drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated
  using (
    public.is_admin()
    or employee_id = public.employee_id_for_user()
    or public.is_project_creator(project_id, auth.uid())
  );

drop policy if exists projects_member_read on public.projects;
create policy projects_member_read on public.projects for select to authenticated
  using (
    public.is_project_member(id, public.employee_id_for_user())
  );

drop policy if exists tasks_project_member_read on public.tasks;
create policy tasks_project_member_read on public.tasks for select to authenticated
  using (
    project_id is not null and public.is_project_member(project_id, public.employee_id_for_user())
  );

-- 3. Enhance documents table with project_id and category (Additive)
alter table public.documents add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.documents add column if not exists category text not null default 'general';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_category_check') then
    alter table public.documents add constraint documents_category_check check (category in ('employee', 'project', 'company', 'sop', 'template', 'knowledge_base', 'general'));
  end if;
end $$;

create index if not exists documents_project_idx on public.documents(project_id);
create index if not exists documents_category_idx on public.documents(category);

-- 4. Harden documents table RLS to support categories and project membership
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (
    public.is_admin()
    or uploaded_by = auth.uid()
    or (owner_id is not null and owner_id = public.employee_id_for_user())
    or (category in ('company', 'sop', 'template', 'knowledge_base'))
    or (department_id is not null and department_id in (select department_id from public.employees where profile_id = auth.uid()))
    or (project_id is not null and public.can_access_project(project_id))
  );

-- 5. Harden storage policies for documents and daily reports
drop policy if exists documents_files_read on storage.objects;
create policy documents_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin()
    or owner_id = auth.uid()::text
    or exists (
      select 1 from public.documents d
      where d.storage_path = name
        and (
          d.uploaded_by = auth.uid()
          or (d.owner_id is not null and d.owner_id = public.employee_id_for_user())
          or (d.category in ('company', 'sop', 'template', 'knowledge_base'))
          or (d.department_id is not null and d.department_id in (select department_id from public.employees where profile_id = auth.uid()))
          or (d.project_id is not null and public.can_access_project(d.project_id))
        )
    )
  )
);

drop policy if exists report_files_read on storage.objects;
create policy report_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'daily-report-attachments'
  and (
    public.is_admin()
    or owner_id = auth.uid()::text
    or exists (
      select 1 from public.daily_report_attachments dra
      join public.daily_reports r on r.id = dra.daily_report_id
      where dra.storage_path = name
        and (r.employee_id = public.employee_id_for_user() or public.is_admin())
    )
  )
);
