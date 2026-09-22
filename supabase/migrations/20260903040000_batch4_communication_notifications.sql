-- Batch 4 communication and notification engine. Additive only.
alter table public.notifications
  add column if not exists actor_id uuid references public.profiles(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  task_notifications boolean not null default true,
  report_notifications boolean not null default true,
  leave_notifications boolean not null default true,
  mention_notifications boolean not null default true,
  announcement_notifications boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid references public.teams(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 10000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint feed_post_context_check check (team_id is not null or project_id is not null)
);

create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.feed_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_comment_id uuid references public.feed_comments(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('feed_post','feed_comment','announcement','task_comment')),
  entity_id uuid not null,
  reaction text not null check (reaction in ('like','celebrate','support','important')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (actor_id, entity_type, entity_id, reaction)
);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  mentioned_profile_id uuid not null references public.profiles(id) on delete cascade,
  entity_type text not null check (entity_type in ('feed_post','feed_comment','task_comment')),
  entity_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (mentioned_profile_id, entity_type, entity_id)
);

create index if not exists feed_posts_team_created_idx on public.feed_posts(team_id, created_at desc);
create index if not exists feed_posts_project_created_idx on public.feed_posts(project_id, created_at desc);
create index if not exists feed_comments_post_created_idx on public.feed_comments(post_id, created_at);
create index if not exists notifications_recipient_created_idx on public.notifications(recipient_id, created_at desc);

do $$ declare t text; begin
  foreach t in array array['notification_preferences','feed_posts','feed_comments'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

create or replace function public.can_access_feed_post(target_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.feed_posts p
    where p.id = target_post and (
      p.author_id = auth.uid()
      or (p.team_id is not null and exists (select 1 from public.team_members tm where tm.team_id=p.team_id and tm.employee_id=public.employee_id_for_user()))
      or (p.project_id is not null and exists (select 1 from public.project_members pm where pm.project_id=p.project_id and pm.employee_id=public.employee_id_for_user()))
    )
  );
$$;
grant execute on function public.can_access_feed_post(uuid) to authenticated;

alter table public.notification_preferences enable row level security;
alter table public.feed_posts enable row level security;
alter table public.feed_comments enable row level security;
alter table public.reactions enable row level security;
alter table public.mentions enable row level security;

create policy notification_preferences_own on public.notification_preferences for all to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

create policy feed_posts_read on public.feed_posts for select to authenticated
using (public.can_access_feed_post(id));
create policy feed_posts_insert on public.feed_posts for insert to authenticated
with check (author_id = auth.uid() and (
  (team_id is not null and exists (select 1 from public.team_members tm where tm.team_id=feed_posts.team_id and tm.employee_id=public.employee_id_for_user()))
  or (project_id is not null and exists (select 1 from public.project_members pm where pm.project_id=feed_posts.project_id and pm.employee_id=public.employee_id_for_user()))
));
create policy feed_posts_update on public.feed_posts for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());
create policy feed_posts_delete on public.feed_posts for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

create policy feed_comments_read on public.feed_comments for select to authenticated
using (public.can_access_feed_post(post_id));
create policy feed_comments_insert on public.feed_comments for insert to authenticated
with check (author_id = auth.uid() and public.can_access_feed_post(post_id));
create policy feed_comments_update on public.feed_comments for update to authenticated
using (author_id = auth.uid() or public.is_admin())
with check (author_id = auth.uid() or public.is_admin());
create policy feed_comments_delete on public.feed_comments for delete to authenticated
using (author_id = auth.uid() or public.is_admin());

create policy reactions_read on public.reactions for select to authenticated
using (
  actor_id = auth.uid() or
  (entity_type = 'feed_post' and public.can_access_feed_post(entity_id)) or
  (entity_type = 'feed_comment' and exists (select 1 from public.feed_comments c where c.id=entity_id and public.can_access_feed_post(c.post_id)))
);
create policy reactions_write on public.reactions for all to authenticated
using (actor_id = auth.uid() or public.is_admin())
with check (actor_id = auth.uid() and (
  (entity_type = 'feed_post' and public.can_access_feed_post(entity_id)) or
  (entity_type = 'feed_comment' and exists (select 1 from public.feed_comments c where c.id=entity_id and public.can_access_feed_post(c.post_id)))
));

create policy mentions_read on public.mentions for select to authenticated
using (actor_id = auth.uid() or mentioned_profile_id = auth.uid() or public.is_admin());
create policy mentions_insert on public.mentions for insert to authenticated
with check (actor_id = auth.uid() and mentioned_profile_id <> auth.uid());

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.feed_posts;
    alter publication supabase_realtime add table public.feed_comments;
    alter publication supabase_realtime add table public.notifications;
  end if;
exception when duplicate_object then null; end $$;
