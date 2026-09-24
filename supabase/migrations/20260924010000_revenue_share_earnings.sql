-- Noryxa revenue share and member earnings ledger.
-- Business rule: 60% company share, 35% closer, 5% direct sponsor.
-- Self-sourced and self-closed deals receive the full 40% member share.

create table if not exists public.member_sponsors (
  member_employee_id uuid primary key references public.employees(id) on delete cascade,
  sponsor_employee_id uuid not null references public.employees(id) on delete restrict,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint member_sponsors_not_self check (member_employee_id <> sponsor_employee_id)
);

create table if not exists public.project_revenue (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  total_amount numeric(14,2) not null check (total_amount >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0 and amount_paid <= total_amount),
  currency text not null default 'PKR' check (currency in ('PKR','USD','AED','GBP','EUR')),
  payment_status text not null default 'pending' check (payment_status in ('pending','partially_paid','paid','cancelled')),
  client_brought_by uuid references public.employees(id) on delete set null,
  closed_by uuid references public.employees(id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint project_revenue_paid_status_check check (
    (payment_status = 'pending' and amount_paid = 0)
    or (payment_status = 'partially_paid' and amount_paid > 0 and amount_paid < total_amount)
    or (payment_status = 'paid' and amount_paid > 0)
    or payment_status = 'cancelled'
  )
);

create table if not exists public.commission_entries (
  id uuid primary key default gen_random_uuid(),
  project_revenue_id uuid not null references public.project_revenue(id) on delete cascade,
  recipient_employee_id uuid not null references public.employees(id) on delete restrict,
  commission_type text not null check (commission_type in ('closer','sponsor')),
  percentage numeric(5,2) not null check (percentage > 0 and percentage <= 40),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid')),
  paid_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_revenue_id, commission_type)
);

create index if not exists member_sponsors_sponsor_idx on public.member_sponsors(sponsor_employee_id);
create index if not exists project_revenue_payment_idx on public.project_revenue(payment_status, created_at desc);
create index if not exists project_revenue_closer_idx on public.project_revenue(closed_by, created_at desc);
create index if not exists commission_entries_recipient_idx on public.commission_entries(recipient_employee_id, status, created_at desc);

drop trigger if exists member_sponsors_updated_at on public.member_sponsors;
create trigger member_sponsors_updated_at before update on public.member_sponsors
for each row execute function public.set_updated_at();

drop trigger if exists project_revenue_updated_at on public.project_revenue;
create trigger project_revenue_updated_at before update on public.project_revenue
for each row execute function public.set_updated_at();

drop trigger if exists commission_entries_updated_at on public.commission_entries;
create trigger commission_entries_updated_at before update on public.commission_entries
for each row execute function public.set_updated_at();

create or replace function public.prevent_sponsor_cycle()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cursor_employee uuid := new.sponsor_employee_id;
  hops integer := 0;
begin
  while cursor_employee is not null and hops < 100 loop
    if cursor_employee = new.member_employee_id then
      raise exception 'Sponsor relationship would create a cycle';
    end if;
    select ms.sponsor_employee_id into cursor_employee
    from public.member_sponsors ms
    where ms.member_employee_id = cursor_employee;
    hops := hops + 1;
  end loop;
  return new;
end;
$$;

drop trigger if exists member_sponsors_cycle_guard on public.member_sponsors;
create trigger member_sponsors_cycle_guard before insert or update on public.member_sponsors
for each row execute function public.prevent_sponsor_cycle();

create or replace function public.rebuild_commission_entries(target_revenue_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  revenue_row public.project_revenue%rowtype;
  sponsor_id uuid;
  closer_rate numeric(5,2);
  closer_amount numeric(14,2);
begin
  select * into revenue_row from public.project_revenue where id = target_revenue_id;
  if not found then raise exception 'Revenue record not found'; end if;

  delete from public.commission_entries
  where project_revenue_id = target_revenue_id and status <> 'paid';

  if revenue_row.payment_status <> 'paid' or revenue_row.amount_paid <= 0 or revenue_row.closed_by is null then
    return;
  end if;

  if revenue_row.client_brought_by = revenue_row.closed_by then
    closer_rate := 40;
  else
    closer_rate := 35;
  end if;
  closer_amount := round(revenue_row.amount_paid * closer_rate / 100, 2);

  insert into public.commission_entries(project_revenue_id, recipient_employee_id, commission_type, percentage, amount)
  values (target_revenue_id, revenue_row.closed_by, 'closer', closer_rate, closer_amount)
  on conflict (project_revenue_id, commission_type) do update set
    recipient_employee_id = excluded.recipient_employee_id,
    percentage = excluded.percentage,
    amount = excluded.amount,
    updated_at = timezone('utc', now())
  where public.commission_entries.status <> 'paid';

  if revenue_row.client_brought_by <> revenue_row.closed_by then
    select ms.sponsor_employee_id into sponsor_id
    from public.member_sponsors ms
    where ms.member_employee_id = revenue_row.closed_by;

    if sponsor_id is not null then
      insert into public.commission_entries(project_revenue_id, recipient_employee_id, commission_type, percentage, amount)
      values (target_revenue_id, sponsor_id, 'sponsor', 5, round(revenue_row.amount_paid * 5 / 100, 2))
      on conflict (project_revenue_id, commission_type) do update set
        recipient_employee_id = excluded.recipient_employee_id,
        percentage = excluded.percentage,
        amount = excluded.amount,
        updated_at = timezone('utc', now())
      where public.commission_entries.status <> 'paid';
    end if;
  end if;
end;
$$;

alter table public.member_sponsors enable row level security;
alter table public.project_revenue enable row level security;
alter table public.commission_entries enable row level security;

drop policy if exists member_sponsors_read on public.member_sponsors;
create policy member_sponsors_read on public.member_sponsors for select to authenticated
using (
  public.is_admin()
  or member_employee_id = public.employee_id_for_user()
  or sponsor_employee_id = public.employee_id_for_user()
);
drop policy if exists member_sponsors_admin_write on public.member_sponsors;
create policy member_sponsors_admin_write on public.member_sponsors for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists project_revenue_read on public.project_revenue;
create policy project_revenue_read on public.project_revenue for select to authenticated
using (
  public.is_admin()
  or client_brought_by = public.employee_id_for_user()
  or closed_by = public.employee_id_for_user()
  or exists (
    select 1 from public.commission_entries ce
    where ce.project_revenue_id = project_revenue.id
      and ce.recipient_employee_id = public.employee_id_for_user()
  )
);
drop policy if exists project_revenue_admin_write on public.project_revenue;
create policy project_revenue_admin_write on public.project_revenue for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists commission_entries_read on public.commission_entries;
create policy commission_entries_read on public.commission_entries for select to authenticated
using (public.is_admin() or recipient_employee_id = public.employee_id_for_user());
drop policy if exists commission_entries_admin_write on public.commission_entries;
create policy commission_entries_admin_write on public.commission_entries for all to authenticated
using (public.is_admin()) with check (public.is_admin());

revoke all on function public.rebuild_commission_entries(uuid) from public, anon, authenticated;
grant execute on function public.rebuild_commission_entries(uuid) to service_role;
grant select on public.member_sponsors, public.project_revenue, public.commission_entries to authenticated;
grant insert, update, delete on public.member_sponsors, public.project_revenue, public.commission_entries to authenticated;
