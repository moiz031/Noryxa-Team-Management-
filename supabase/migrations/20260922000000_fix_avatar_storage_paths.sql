-- Allow versioned avatar filenames inside the authenticated user's own folder.
-- The previous hardening migration only allowed the literal "<uid>/avatar"
-- path, while the application stores versioned files such as
-- "<uid>/avatar-<timestamp>.png".

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
using (
  bucket_id = 'avatars' and (
    public.is_admin() or name like concat(auth.uid()::text, '/%')
  )
);

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for all to authenticated
using (
  bucket_id = 'avatars' and (
    public.is_admin() or name like concat(auth.uid()::text, '/%')
  )
)
with check (
  bucket_id = 'avatars' and (
    public.is_admin() or name like concat(auth.uid()::text, '/%')
  )
);
