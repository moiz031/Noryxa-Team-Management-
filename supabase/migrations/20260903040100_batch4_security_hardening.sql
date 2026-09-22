-- Batch 4 security hardening: preserve admin publishing and server-side mention validation.
drop policy if exists feed_posts_insert on public.feed_posts;
create policy feed_posts_insert on public.feed_posts
for insert to authenticated
with check (
  author_id = auth.uid()
  and (
    public.is_admin()
    or (team_id is not null and exists (
      select 1 from public.team_members tm
      where tm.team_id = feed_posts.team_id
        and tm.employee_id = public.employee_id_for_user()
    ))
    or (project_id is not null and exists (
      select 1 from public.project_members pm
      where pm.project_id = feed_posts.project_id
        and pm.employee_id = public.employee_id_for_user()
    ))
  )
);

drop policy if exists mentions_insert on public.mentions;
create policy mentions_insert on public.mentions
for insert to authenticated
with check (public.is_admin() and actor_id = auth.uid() and mentioned_profile_id <> auth.uid());
