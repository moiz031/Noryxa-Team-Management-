-- Batch 18: Add nullable `seed_tag` column to every table that is touched by
-- the dev/test seed script. Rows with seed_tag = 'dev_seed' are fixture data
-- and can be safely removed by the cleanup() function at any time.
-- This column must NEVER be used in production business logic.

alter table public.profiles        add column if not exists seed_tag text;
alter table public.departments     add column if not exists seed_tag text;
alter table public.teams           add column if not exists seed_tag text;
alter table public.clients         add column if not exists seed_tag text;
alter table public.projects        add column if not exists seed_tag text;
alter table public.project_members add column if not exists seed_tag text;
alter table public.tasks           add column if not exists seed_tag text;
alter table public.daily_reports   add column if not exists seed_tag text;
alter table public.attendance      add column if not exists seed_tag text;
alter table public.leave_requests  add column if not exists seed_tag text;
alter table public.notifications   add column if not exists seed_tag text;
alter table public.feed_posts      add column if not exists seed_tag text;
alter table public.documents       add column if not exists seed_tag text;

-- Partial indexes to make cleanup() fast (scoped deletes by seed_tag).
create index if not exists profiles_seed_tag_idx        on public.profiles        (seed_tag) where seed_tag is not null;
create index if not exists departments_seed_tag_idx     on public.departments     (seed_tag) where seed_tag is not null;
create index if not exists teams_seed_tag_idx           on public.teams           (seed_tag) where seed_tag is not null;
create index if not exists clients_seed_tag_idx         on public.clients         (seed_tag) where seed_tag is not null;
create index if not exists projects_seed_tag_idx        on public.projects        (seed_tag) where seed_tag is not null;
create index if not exists project_members_seed_tag_idx on public.project_members (seed_tag) where seed_tag is not null;
create index if not exists tasks_seed_tag_idx           on public.tasks           (seed_tag) where seed_tag is not null;
create index if not exists daily_reports_seed_tag_idx   on public.daily_reports   (seed_tag) where seed_tag is not null;
create index if not exists attendance_seed_tag_idx      on public.attendance      (seed_tag) where seed_tag is not null;
create index if not exists leave_requests_seed_tag_idx  on public.leave_requests  (seed_tag) where seed_tag is not null;
create index if not exists notifications_seed_tag_idx   on public.notifications   (seed_tag) where seed_tag is not null;
create index if not exists feed_posts_seed_tag_idx      on public.feed_posts      (seed_tag) where seed_tag is not null;
create index if not exists documents_seed_tag_idx       on public.documents       (seed_tag) where seed_tag is not null;
