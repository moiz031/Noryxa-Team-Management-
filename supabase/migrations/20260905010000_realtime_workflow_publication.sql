-- Additive Realtime coverage for workflow events exercised by authenticated clients.
do $$
declare
  relation_name regclass;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach relation_name in array array[
      'public.leave_requests'::regclass,
      'public.project_members'::regclass,
      'public.feed_posts'::regclass,
      'public.feed_comments'::regclass,
      'public.notifications'::regclass
    ] loop
      if not exists (
        select 1
        from pg_publication_rel pr
        join pg_publication p on p.oid = pr.prpubid
        where p.pubname = 'supabase_realtime'
          and pr.prrelid = relation_name
      ) then
        execute format('alter publication supabase_realtime add table %s', relation_name);
      end if;
    end loop;
  end if;
end $$;

alter table public.leave_requests replica identity full;
alter table public.notifications replica identity full;
