-- ============================================================================
-- 0042_attendance_location_pings.sql — live location tracking during an open
-- attendance session (foreground-only: see src/components/attendance/
-- use-live-tracking.ts for the platform limitation this is built around — a
-- website cannot track location once the phone is locked / backgrounded, so
-- this is a periodic ping while the page stays open, not true background
-- tracking).
-- ----------------------------------------------------------------------------
-- One row per GPS ping. Tied to the specific day's attendance row so a ping
-- can never outlive (or be mistaken for) the shift it belongs to — deleting
-- the attendance row cascades and removes its pings too.
-- ============================================================================

create table if not exists public.attendance_location_pings (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  attendance_id  uuid not null references public.employee_attendance(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  lat            double precision not null,
  lng            double precision not null,
  accuracy       real,
  recorded_at    timestamptz not null default now()
);

create index if not exists attendance_location_pings_attendance_idx
  on public.attendance_location_pings (attendance_id, recorded_at desc);
create index if not exists attendance_location_pings_org_idx
  on public.attendance_location_pings (org_id, recorded_at desc);

alter table public.attendance_location_pings enable row level security;

-- Same privacy model as the attendance table itself (0016/0017): a staff
-- member's live location is visible only to themselves and to super_admin/hr,
-- never to teammates. Write is self-only (you can only ping your own shift).
drop policy if exists alp_read on public.attendance_location_pings;
create policy alp_read on public.attendance_location_pings for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

drop policy if exists alp_insert on public.attendance_location_pings;
create policy alp_insert on public.attendance_location_pings for insert to authenticated
  with check (public.is_org_member(org_id) and user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- ROLLBACK: drop table public.attendance_location_pings;  (policies/indexes
-- drop automatically with it)
-- ----------------------------------------------------------------------------
