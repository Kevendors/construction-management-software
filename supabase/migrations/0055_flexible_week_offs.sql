-- ============================================================================
-- 0055_flexible_week_offs.sql — Flexible staff choose their weekly off day.
-- One row = one chosen off day. At most ONE per employee per Monday–Sunday
-- week (unique on week_start, the Monday). Missed days are never turned into
-- weekly offs: on a Flexible day only a row here makes it a weekly off.
--
-- The employee picks today or a later day of this/next week; Super Admin/HR
-- can set, move or remove any day (incl. past days). Every write goes through
-- server actions with the service-role client, which gate themselves, so
-- there are no insert/update/delete policies. Idempotent.
-- ============================================================================

create table if not exists public.attendance_flex_week_offs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  week_start  date not null,                -- Monday of `date`'s week
  set_by      uuid references public.profiles(id) on delete set null,
  set_by_admin boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, date),
  unique (user_id, week_start),
  check (extract(isodow from week_start) = 1 and date between week_start and week_start + 6)
);

create index if not exists attendance_flex_week_offs_org_date_idx
  on public.attendance_flex_week_offs (org_id, date);

alter table public.attendance_flex_week_offs enable row level security;

-- Same privacy model as the other attendance tables: self + super_admin/hr.
drop policy if exists afwo_read on public.attendance_flex_week_offs;
create policy afwo_read on public.attendance_flex_week_offs for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table public.attendance_flex_week_offs;
-- (The app then shows no Flexible weekly offs at all — missed days stay Absent.)
-- ----------------------------------------------------------------------------
