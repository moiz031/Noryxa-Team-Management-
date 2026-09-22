-- Batch 3 task execution: hierarchy, checklists, dependencies, time, comments and files.
create extension if not exists btree_gist;

alter table public.tasks add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade;
alter table public.tasks add column if not exists start_date date;
alter table public.tasks add column if not exists due_date date;
alter table public.tasks add constraint tasks_date_order_check check (due_date is null or start_date is null or due_date >= start_date);

create table if not exists public.task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 500),
  is_completed boolean not null default false,
  position integer not null default 0 check (position >= 0),
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (task_id, position)
);

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer generated always as
    (case when ended_at is null then null else greatest(0, extract(epoch from (ended_at - started_at))::integer) end) stored,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ended_at is null or ended_at > started_at)
);
create unique index if not exists one_running_timer_per_employee on public.time_entries(employee_id) where ended_at is null;
alter table public.time_entries drop constraint if exists time_entries_no_overlap;
alter table public.time_entries add constraint time_entries_no_overlap exclude using gist
  (employee_id with =, tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&);

create or replace function public.prevent_task_hierarchy_cycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.parent_task_id is not null and (
    new.parent_task_id = new.id or exists (
      with recursive ancestors(id) as (
        select new.parent_task_id
        union all select t.parent_task_id from public.tasks t join ancestors a on a.id = t.id
        where t.parent_task_id is not null
      ) select 1 from ancestors where id = new.id
    )
  ) then raise exception 'Task hierarchy cycle is not allowed'; end if;
  return new;
end $$;
drop trigger if exists tasks_hierarchy_cycle on public.tasks;
create trigger tasks_hierarchy_cycle before insert or update of parent_task_id on public.tasks
for each row execute function public.prevent_task_hierarchy_cycle();

create or replace function public.prevent_task_dependency_cycle()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (
    with recursive reachable(id) as (
      select new.depends_on_task_id
      union all select d.depends_on_task_id from public.task_dependencies d join reachable r on r.id = d.task_id
    ) select 1 from reachable where id = new.task_id
  ) then raise exception 'Task dependency cycle is not allowed'; end if;
  return new;
end $$;
drop trigger if exists task_dependencies_cycle on public.task_dependencies;
create trigger task_dependencies_cycle before insert or update on public.task_dependencies
for each row execute function public.prevent_task_dependency_cycle();

create or replace function public.task_is_overdue(t public.tasks)
returns boolean language sql stable as $$
  select t.due_date < current_date and t.status not in ('completed','cancelled')
$$;

create index if not exists tasks_parent_idx on public.tasks(parent_task_id);
create index if not exists tasks_due_date_idx on public.tasks(due_date) where due_date is not null;
create index if not exists checklist_task_position_idx on public.task_checklist_items(task_id, position);
create index if not exists dependencies_depends_on_idx on public.task_dependencies(depends_on_task_id);
create index if not exists time_entries_task_idx on public.time_entries(task_id, started_at desc);
create index if not exists time_entries_employee_idx on public.time_entries(employee_id, started_at desc);

do $$ declare t text; begin
  foreach t in array array['task_checklist_items','time_entries'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

alter table public.task_checklist_items enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.time_entries enable row level security;

drop policy if exists checklist_read on public.task_checklist_items;
create policy checklist_read on public.task_checklist_items for select to authenticated using (
  public.is_admin() or exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid() or exists
      (select 1 from public.project_members m where m.project_id=t.project_id and m.employee_id=public.employee_id_for_user())))
);
drop policy if exists checklist_write on public.task_checklist_items;
create policy checklist_write on public.task_checklist_items for all to authenticated using (
  public.is_admin() or created_by=auth.uid() or updated_by=auth.uid()
) with check (public.is_admin() or created_by=auth.uid() or updated_by=auth.uid());

drop policy if exists dependencies_read on public.task_dependencies;
create policy dependencies_read on public.task_dependencies for select to authenticated using (
  public.is_admin() or exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid()))
);
drop policy if exists dependencies_write on public.task_dependencies;
create policy dependencies_write on public.task_dependencies for all to authenticated using (public.is_admin())
with check (public.is_admin());

drop policy if exists time_entries_read on public.time_entries;
create policy time_entries_read on public.time_entries for select to authenticated using (
  public.is_admin() or employee_id=public.employee_id_for_user()
);
drop policy if exists time_entries_write on public.time_entries;
create policy time_entries_write on public.time_entries for all to authenticated using (
  public.is_admin() or employee_id=public.employee_id_for_user()
) with check (public.is_admin() or employee_id=public.employee_id_for_user());

drop policy if exists task_comments_delete on public.task_comments;
create policy task_comments_delete on public.task_comments for delete to authenticated using (author_id=auth.uid() or public.is_admin());
drop policy if exists task_comments_read on public.task_comments;
create policy task_comments_read on public.task_comments for select to authenticated using (
  public.is_admin() or author_id=auth.uid() or exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid() or exists
      (select 1 from public.project_members m where m.project_id=t.project_id and m.employee_id=public.employee_id_for_user())))
);
drop policy if exists task_comments_write on public.task_comments;
create policy task_comments_write on public.task_comments for insert to authenticated with check (
  author_id=auth.uid() and exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid() or public.is_admin() or exists
      (select 1 from public.project_members m where m.project_id=t.project_id and m.employee_id=public.employee_id_for_user())))
);
drop policy if exists task_comments_update on public.task_comments;
create policy task_comments_update on public.task_comments for update to authenticated
using (author_id=auth.uid() or public.is_admin()) with check (author_id=auth.uid() or public.is_admin());

drop policy if exists task_attachments_read on public.task_attachments;
create policy task_attachments_read on public.task_attachments for select to authenticated using (
  public.is_admin() or uploaded_by=auth.uid() or exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid() or exists
      (select 1 from public.project_members m where m.project_id=t.project_id and m.employee_id=public.employee_id_for_user())))
);
drop policy if exists task_attachments_write on public.task_attachments;
create policy task_attachments_write on public.task_attachments for insert to authenticated with check (
  uploaded_by=auth.uid() and exists (select 1 from public.tasks t where t.id=task_id and
    (t.assigned_to=public.employee_id_for_user() or t.created_by=auth.uid() or public.is_admin() or exists
      (select 1 from public.project_members m where m.project_id=t.project_id and m.employee_id=public.employee_id_for_user())))
);
drop policy if exists task_attachments_delete on public.task_attachments;
create policy task_attachments_delete on public.task_attachments for delete to authenticated using (uploaded_by=auth.uid() or public.is_admin());

drop policy if exists task_files_delete on storage.objects;
create policy task_files_delete on storage.objects for delete to authenticated using (
  bucket_id='task-attachments' and (public.is_admin() or owner_id=auth.uid()::text)
);

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.task_checklist_items;
    alter publication supabase_realtime add table public.task_dependencies;
    alter publication supabase_realtime add table public.time_entries;
  end if;
exception when duplicate_object then null; end $$;
