-- Batch 9: Global Search Indexes
-- Fast text search acceleration using PostgreSQL pg_trgm extension and GIN indexes.

create extension if not exists pg_trgm;

create index if not exists tasks_title_trgm_idx on public.tasks using gin (title gin_trgm_ops);
create index if not exists projects_name_trgm_idx on public.projects using gin (name gin_trgm_ops);
create index if not exists clients_name_trgm_idx on public.clients using gin (name gin_trgm_ops);
create index if not exists teams_name_trgm_idx on public.teams using gin (name gin_trgm_ops);
create index if not exists documents_title_trgm_idx on public.documents using gin (title gin_trgm_ops);
create index if not exists announcements_title_trgm_idx on public.announcements using gin (title gin_trgm_ops);
create index if not exists profiles_search_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
