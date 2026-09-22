-- 20260906030000_full_file_management_security.sql
-- Rigorous RLS policies and storage security for full document & attachment management.

-- 1. Helper function for daily reports access
create or replace function public.can_access_daily_report(target_report uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.daily_reports r
      where r.id = target_report
        and (
          r.employee_id = public.employee_id_for_user()
          or r.created_by = auth.uid()
        )
    );
$$;

grant execute on function public.can_access_daily_report(uuid) to authenticated;

-- 2. Drop legacy / placeholder policies on additive document tables
drop policy if exists employee_documents_read on public.employee_documents;
drop policy if exists employee_documents_upload on public.employee_documents;
drop policy if exists employee_documents_insert on public.employee_documents;
drop policy if exists employee_documents_update on public.employee_documents;
drop policy if exists employee_documents_delete on public.employee_documents;

drop policy if exists project_documents_read on public.project_documents;
drop policy if exists project_documents_upload on public.project_documents;
drop policy if exists project_documents_insert on public.project_documents;
drop policy if exists project_documents_update on public.project_documents;
drop policy if exists project_documents_delete on public.project_documents;

drop policy if exists company_documents_read on public.company_documents;
drop policy if exists company_documents_upload on public.company_documents;
drop policy if exists company_documents_insert on public.company_documents;
drop policy if exists company_documents_update on public.company_documents;
drop policy if exists company_documents_delete on public.company_documents;

drop policy if exists sops_read on public.sops;
drop policy if exists sops_upload on public.sops;
drop policy if exists sops_insert on public.sops;
drop policy if exists sops_update on public.sops;
drop policy if exists sops_delete on public.sops;

drop policy if exists templates_read on public.templates;
drop policy if exists templates_upload on public.templates;
drop policy if exists templates_insert on public.templates;
drop policy if exists templates_update on public.templates;
drop policy if exists templates_delete on public.templates;

drop policy if exists kb_attachments_read on public.knowledge_base_attachments;
drop policy if exists kb_attachments_upload on public.knowledge_base_attachments;
drop policy if exists kb_attachments_insert on public.knowledge_base_attachments;
drop policy if exists kb_attachments_update on public.knowledge_base_attachments;
drop policy if exists kb_attachments_delete on public.knowledge_base_attachments;

-- 3. Strict RLS for employee_documents
create policy employee_documents_read on public.employee_documents
  for select to authenticated
  using (
    public.is_admin()
    or employee_id = public.employee_id_for_user()
    or uploaded_by = auth.uid()
  );

create policy employee_documents_insert on public.employee_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and (public.is_admin() or employee_id = public.employee_id_for_user())
  );

create policy employee_documents_update on public.employee_documents
  for update to authenticated
  using (
    public.is_admin()
    or (uploaded_by = auth.uid() and employee_id = public.employee_id_for_user())
  );

create policy employee_documents_delete on public.employee_documents
  for delete to authenticated
  using (
    public.is_admin()
    or (uploaded_by = auth.uid() and employee_id = public.employee_id_for_user())
  );

-- 4. Strict RLS for project_documents
create policy project_documents_read on public.project_documents
  for select to authenticated
  using (public.can_access_project(project_id));

create policy project_documents_insert on public.project_documents
  for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.can_access_project(project_id)
  );

create policy project_documents_update on public.project_documents
  for update to authenticated
  using (
    public.can_access_project(project_id)
    and (public.is_admin() or uploaded_by = auth.uid())
  );

create policy project_documents_delete on public.project_documents
  for delete to authenticated
  using (
    public.can_access_project(project_id)
    and (public.is_admin() or uploaded_by = auth.uid())
  );

-- 5. Strict RLS for company_documents (read: all internal, write/delete: admin only)
create policy company_documents_read on public.company_documents
  for select to authenticated
  using (public.is_admin() or public.employee_id_for_user() is not null);

create policy company_documents_insert on public.company_documents
  for insert to authenticated
  with check (public.is_admin());

create policy company_documents_update on public.company_documents
  for update to authenticated
  using (public.is_admin());

create policy company_documents_delete on public.company_documents
  for delete to authenticated
  using (public.is_admin());

-- 6. Strict RLS for sops (read: all internal, write/delete: admin only)
create policy sops_read on public.sops
  for select to authenticated
  using (public.is_admin() or public.employee_id_for_user() is not null);

create policy sops_insert on public.sops
  for insert to authenticated
  with check (public.is_admin());

create policy sops_update on public.sops
  for update to authenticated
  using (public.is_admin());

create policy sops_delete on public.sops
  for delete to authenticated
  using (public.is_admin());

-- 7. Strict RLS for templates (read: all internal, write/delete: admin or owner)
create policy templates_read on public.templates
  for select to authenticated
  using (public.is_admin() or public.employee_id_for_user() is not null);

create policy templates_insert on public.templates
  for insert to authenticated
  with check (public.is_admin() or owner_id = auth.uid());

create policy templates_update on public.templates
  for update to authenticated
  using (public.is_admin() or owner_id = auth.uid());

create policy templates_delete on public.templates
  for delete to authenticated
  using (public.is_admin() or owner_id = auth.uid());

-- 8. Strict RLS for knowledge_base_attachments
create policy kb_attachments_read on public.knowledge_base_attachments
  for select to authenticated
  using (public.is_admin() or public.employee_id_for_user() is not null);

create policy kb_attachments_insert on public.knowledge_base_attachments
  for insert to authenticated
  with check (public.is_admin() or uploaded_by = auth.uid());

create policy kb_attachments_update on public.knowledge_base_attachments
  for update to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

create policy kb_attachments_delete on public.knowledge_base_attachments
  for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- 9. Storage policies on storage.objects for bucket 'documents'
drop policy if exists documents_files_read on storage.objects;
create policy documents_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin()
    or exists (
      select 1 from public.employee_documents ed
      where ed.storage_path = name
        and (ed.employee_id = public.employee_id_for_user() or ed.uploaded_by = auth.uid() or public.is_admin())
    )
    or exists (
      select 1 from public.project_documents pd
      where pd.storage_path = name
        and public.can_access_project(pd.project_id)
    )
    or exists (
      select 1 from public.company_documents cd
      where cd.storage_path = name
        and (public.is_admin() or public.employee_id_for_user() is not null)
    )
    or exists (
      select 1 from public.sops s
      where s.storage_path = name
        and (public.is_admin() or public.employee_id_for_user() is not null)
    )
    or exists (
      select 1 from public.templates t
      where t.storage_path = name
        and (public.is_admin() or public.employee_id_for_user() is not null)
    )
    or exists (
      select 1 from public.knowledge_base_attachments kb
      where kb.storage_path = name
        and (public.is_admin() or public.employee_id_for_user() is not null)
    )
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

drop policy if exists documents_files_write on storage.objects;
create policy documents_files_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'documents'
  and (
    public.is_admin()
    or name like (auth.uid() || '/%')
  )
);

drop policy if exists documents_files_delete on storage.objects;
create policy documents_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'documents'
  and (
    public.is_admin()
    or name like (auth.uid() || '/%')
  )
);

-- 10. Storage policies on storage.objects for bucket 'daily-report-attachments'
drop policy if exists report_files_read on storage.objects;
create policy report_files_read on storage.objects for select to authenticated
using (
  bucket_id = 'daily-report-attachments'
  and (
    public.is_admin()
    or exists (
      select 1 from public.daily_report_attachments dra
      where dra.storage_path = name
        and public.can_access_daily_report(dra.daily_report_id)
    )
  )
);

drop policy if exists report_files_write on storage.objects;
create policy report_files_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'daily-report-attachments'
  and (
    public.is_admin()
    or name like (auth.uid() || '/%')
  )
);

drop policy if exists report_files_delete on storage.objects;
create policy report_files_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'daily-report-attachments'
  and (
    public.is_admin()
    or name like (auth.uid() || '/%')
  )
);
