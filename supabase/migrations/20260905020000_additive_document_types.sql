-- Additive migration: New document types for file management system
-- Adds tables for employee documents, project documents, company documents,
-- SOPs, templates, and knowledge-base attachments with proper RLS and storage integration.

-- 1. employee_documents table
create table if not exists public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  description text,
  category text not null default 'employee',
  version integer not null default 1,
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.employee_documents is 'Employee-specific documents (ID cards, contracts, certifications)';

-- 2. project_documents table
create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  description text,
  category text not null default 'project',
  version integer not null default 1,
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.project_documents is 'Project-specific documents (contracts, proposals, reports)';

-- 3. company_documents table
create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  description text,
  category text not null default 'company',
  version integer not null default 1,
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_documents is 'Company-wide documents (policies, SOPs, branding assets)';

-- 4. sops table (Standard Operating Procedures)
create table if not exists public.sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'sop',
  version integer not null default 1,
  effective_from date,
  effective_to date,
  owner_id uuid references public.profiles(id),
  storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sops is 'Standard Operating Procedures for agency operations';

-- 5. templates table
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'template',
  description text,
  storage_path text,
  is_active boolean not null default true,
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.templates is ' reusable templates for reports, forms, etc.';

-- 6. knowledge_base_attachments table
create table if not exists public.knowledge_base_attachments (
  id uuid primary key default gen_random_uuid(),
  knowledge_base_id uuid, -- reference to knowledge base articles (would need separate table)
  storage_path text not null,
  file_name text not null,
  mime_type text,
  file_size integer,
  title text,
  tags text[],
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.knowledge_base_attachments is 'Attachments for knowledge base articles';

-- Indexes for performance
create index if not exists idx_employee_documents_employee_id on public.employee_documents(employee_id);
create index if not exists idx_project_documents_project_id on public.project_documents(project_id);
create index if not exists idx_company_documents_category on public.company_documents(category);
create index if not exists idx_sops_category_active on public.sops(category, is_active);
create index if not exists idx_templates_category_active on public.templates(category, is_active);
create index if not exists idx_kb_attachments_uploaded_by on public.knowledge_base_attachments(uploaded_by);
create index if not exists idx_employee_documents_category on public.employee_documents(category);
-- Removed faulty idx_documents_uploaded_at; use idx_documents_created_at from later migration

-- RLS enable
alter table public.employee_documents enable row level security;
alter table public.project_documents enable row level security;
alter table public.company_documents enable row level security;
alter table public.sops enable row level security;
alter table public.templates enable row level security;
alter table public.knowledge_base_attachments enable row level security;

-- Default RLS policies (will be refined in subsequent migrations)
create policy employee_documents_upload on public.employee_documents for insert to authenticated with check (true);
create policy project_documents_upload on public.project_documents for insert to authenticated with check (true);
create policy company_documents_upload on public.company_documents for insert to authenticated with check (true);
create policy sops_upload on public.sops for insert to authenticated with check (true);
create policy templates_upload on public.templates for insert to authenticated with check (true);
create policy kb_attachments_upload on public.knowledge_base_attachments for insert to authenticated with check (true);

create policy employee_documents_read on public.employee_documents for select to authenticated using (true);
create policy project_documents_read on public.project_documents for select to authenticated using (true);
create policy company_documents_read on public.company_documents for select to authenticated using (true);
create policy sops_read on public.sops for select to authenticated using (true);
create policy templates_read on public.templates for select to authenticated using (true);
create policy kb_attachments_read on public.knowledge_base_attachments for select to authenticated using (true);

create policy employee_documents_update on public.employee_documents for update to authenticated using (true);
create policy project_documents_update on public.project_documents for update to authenticated using (true);
create policy company_documents_update on public.company_documents for update to authenticated using (true);
create policy sops_update on public.sops for update to authenticated using (true);
create policy templates_update on public.templates for update to authenticated using (true);
create policy kb_attachments_update on public.knowledge_base_attachments for update to authenticated using (true);

create policy employee_documents_delete on public.employee_documents for delete to authenticated using (true);
create policy project_documents_delete on public.project_documents for delete to authenticated using (true);
create policy company_documents_delete on public.company_documents for delete to authenticated using (true);
create policy sops_delete on public.sops for delete to authenticated using (true);
create policy templates_delete on public.templates for delete to authenticated using (true);
create policy kb_attachments_delete on public.knowledge_base_attachments for delete to authenticated using (true);

-- Activity log triggers (will be set up via separate triggers or application logic)
-- These tables will have activity logging via the existing activity_logs system

-- Grant permissions
grant all on public.employee_documents to authenticated;
grant all on public.project_documents to authenticated;
grant all on public.company_documents to authenticated;
grant all on public.sops to authenticated;
grant all on public.templates to authenticated;
grant all on public.knowledge_base_attachments to authenticated;

-- Document type tables created successfully