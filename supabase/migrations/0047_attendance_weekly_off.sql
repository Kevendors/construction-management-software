-- ============================================================================
-- 0047_attendance_weekly_off.sql — per-employee weekly off day + same-week
-- swaps (comp-off). Sunday used to be hard-coded as everyone's weekly off;
-- now each member has a default (Team page, default Sunday) and Admin/HR can
-- record that an employee works their off day and takes another day off
-- within ±6 days instead. See
-- docs/superpowers/specs/2026-10-26-weekly-off-design.md
-- ----------------------------------------------------------------------------
-- Pay is unchanged: a weekly off is treated exactly like a Sunday off was —
-- not Absent, not added to paid days. The app degrades gracefully (falls back
-- to Sunday-only) until this is applied.
-- ============================================================================

-- The member's CURRENT default weekly off (display + Team select).
-- 0 = Sunday … 6 = Saturday, same numbering as JS Date.getDay().
alter table public.memberships
  add column if not exists weekly_off_dow smallint not null default 0
  check (weekly_off_dow between 0 and 6);

-- Every change to the default, so changing someone's weekly off never
-- rewrites past attendance: a date uses the latest row with
-- effective_from <= date. Written only by the app (setWeeklyOffDayAction):
-- the first change also inserts a baseline row (the previous day, from
-- 2000-01-01). A member with no rows uses weekly_off_dow for every date.
create table if not exists public.attendance_weekly_off_history (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.orgs(id) on delete cascade,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  dow             smallint not null check (dow between 0 and 6),
  effective_from  date not null,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (user_id, effective_from)
);

create index if not exists attendance_weekly_off_history_org_user_idx
  on public.attendance_weekly_off_history (org_id, user_id);

alter table public.attendance_weekly_off_history enable row level security;

-- Same model as the swaps table below: self + super_admin/hr read; no write
-- policies (service-role server actions gate themselves).
drop policy if exists awoh_read on public.attendance_weekly_off_history;
create policy awoh_read on public.attendance_weekly_off_history for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

create table if not exists public.attendance_week_off_swaps (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  -- A default off day the employee works instead…
  worked_date  date not null,
  -- …and the replacement off day taken for it (same week, ±6 days).
  off_date     date not null,
  note         text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (user_id, worked_date),
  unique (user_id, off_date),
  check (off_date <> worked_date and abs(off_date - worked_date) <= 6)
);

create index if not exists attendance_week_off_swaps_org_user_idx
  on public.attendance_week_off_swaps (org_id, user_id);

alter table public.attendance_week_off_swaps enable row level security;

-- Same privacy model as the attendance table (0016/0017, 0042): an employee
-- sees their own swaps; super_admin/hr see the org's. No insert/update/delete
-- policies: every write goes through server actions using the service-role
-- client, which gates itself to super_admin/hr.
drop policy if exists awos_read on public.attendance_week_off_swaps;
create policy awos_read on public.attendance_week_off_swaps for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table public.attendance_week_off_swaps;  (policy/index drop with it)
--   drop table public.attendance_weekly_off_history;  (policy/index drop with it)
--   alter table public.memberships drop column if exists weekly_off_dow;
-- ----------------------------------------------------------------------------
