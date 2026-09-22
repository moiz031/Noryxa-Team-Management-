-- Add grace_period_minutes to work_schedules
alter table public.work_schedules
add column if not exists grace_period_minutes integer not null default 15;

-- Add is_late and minutes_late to attendance
alter table public.attendance
add column if not exists is_late boolean not null default false,
add column if not exists minutes_late integer not null default 0;

-- Prevent invalid checkouts (must have check_in_at if check_out_at is present, and check_out_at >= check_in_at)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'valid_checkout'
      and conrelid = 'public.attendance'::regclass
  ) then
    alter table public.attendance
    add constraint valid_checkout check (
      check_out_at is null or
      (check_in_at is not null and check_out_at >= check_in_at)
    );
  end if;
end $$;

-- Force updated_at triggers on work_schedules (optional but good practice)
-- (It already has one from earlier migrations if standard practices were used, but we are just altering here).
