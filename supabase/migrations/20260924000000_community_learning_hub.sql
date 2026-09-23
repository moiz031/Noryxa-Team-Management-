-- Community and Learning Hub
-- Adds a company-wide community scope to the existing feed and a real
-- admin-published learning library with per-profile progress.

alter table public.feed_posts
  drop constraint if exists feed_post_context_check;

create or replace function public.can_access_feed_post(target_post uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.feed_posts p
    where p.id = target_post and (
      (p.team_id is null and p.project_id is null)
      or p.author_id = auth.uid()
      or (p.team_id is not null and exists (
        select 1 from public.team_members tm
        where tm.team_id = p.team_id and tm.employee_id = public.employee_id_for_user()
      ))
      or (p.project_id is not null and exists (
        select 1 from public.project_members pm
        where pm.project_id = p.project_id and pm.employee_id = public.employee_id_for_user()
      ))
    )
  );
$$;

drop policy if exists feed_posts_insert on public.feed_posts;
create policy feed_posts_insert on public.feed_posts for insert to authenticated
with check (
  author_id = auth.uid() and (
    (team_id is null and project_id is null)
    or (team_id is not null and exists (
      select 1 from public.team_members tm
      where tm.team_id = feed_posts.team_id and tm.employee_id = public.employee_id_for_user()
    ))
    or (project_id is not null and exists (
      select 1 from public.project_members pm
      where pm.project_id = feed_posts.project_id and pm.employee_id = public.employee_id_for_user()
    ))
  )
);

create index if not exists feed_posts_community_created_idx
  on public.feed_posts(created_at desc)
  where team_id is null and project_id is null;

alter table public.reactions drop constraint if exists reactions_entity_type_check;
alter table public.reactions add constraint reactions_entity_type_check
  check (entity_type in ('feed_post','feed_comment','announcement','task_comment'));

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 255),
  description text,
  resource_type text not null default 'guide'
    check (resource_type in ('video','image','guide','test')),
  category text not null default 'general',
  difficulty text not null default 'beginner'
    check (difficulty in ('beginner','intermediate','advanced')),
  content text,
  media_url text,
  image_url text,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 1 and 1440),
  quiz_questions jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.learning_progress (
  resource_id uuid not null references public.learning_resources(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'started' check (status in ('started','completed')),
  score numeric(5,2),
  answers jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (resource_id, profile_id)
);

create index if not exists learning_resources_published_idx
  on public.learning_resources(is_published, created_at desc);
create index if not exists learning_resources_category_idx
  on public.learning_resources(category, resource_type, created_at desc);
create index if not exists learning_progress_profile_idx
  on public.learning_progress(profile_id, updated_at desc);

drop trigger if exists learning_resources_updated_at on public.learning_resources;
create trigger learning_resources_updated_at
before update on public.learning_resources
for each row execute function public.set_updated_at();

drop trigger if exists learning_progress_updated_at on public.learning_progress;
create trigger learning_progress_updated_at
before update on public.learning_progress
for each row execute function public.set_updated_at();

alter table public.learning_resources enable row level security;
alter table public.learning_progress enable row level security;

drop policy if exists learning_resources_read on public.learning_resources;
create policy learning_resources_read on public.learning_resources
for select to authenticated
using (public.is_admin() or is_published = true);

drop policy if exists learning_resources_admin_write on public.learning_resources;
create policy learning_resources_admin_write on public.learning_resources
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists learning_progress_read on public.learning_progress;
create policy learning_progress_read on public.learning_progress
for select to authenticated
using (profile_id = auth.uid() or public.is_admin());

drop policy if exists learning_progress_write on public.learning_progress;
create policy learning_progress_write on public.learning_progress
for all to authenticated
using (profile_id = auth.uid() or public.is_admin())
with check (profile_id = auth.uid() or public.is_admin());

grant select on public.learning_resources to authenticated;
grant insert, update, delete on public.learning_resources to authenticated;
grant select, insert, update on public.learning_progress to authenticated;
