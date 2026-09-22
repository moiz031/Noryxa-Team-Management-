-- Batch 3 storage hardening: task files require metadata-backed task access.
drop policy if exists task_files_read on storage.objects;
create policy task_files_read on storage.objects
for select to authenticated
using (
  bucket_id = 'task-attachments'
  and exists (
    select 1
    from public.task_attachments a
    where a.storage_path = name
      and public.can_access_task(a.task_id)
  )
);

drop policy if exists task_files_delete on storage.objects;
create policy task_files_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'task-attachments'
  and exists (
    select 1
    from public.task_attachments a
    where a.storage_path = name
      and public.can_access_task(a.task_id)
      and (public.is_admin() or a.uploaded_by = auth.uid())
  )
);
