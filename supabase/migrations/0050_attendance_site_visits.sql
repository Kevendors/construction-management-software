-- ============================================================================
-- 0050_attendance_site_visits.sql — "Switch Site": a Site employee can move to
-- another project during an open site shift. Each switch is one row here
-- (GPS + live selfie, like a check-in). The attendance day itself is
-- unchanged: one check-in, one check-out, employee_attendance.project_id
-- stays the FIRST project; pay / weekly-off / leave logic are untouched.
-- The "current site" = project of the latest visit by arrived_at, else the
-- attendance row's project_id. See
-- docs/superpowers/specs/2026-10-29-switch-site-design.md
-- The app treats this table as "no visits" until it exists. Idempotent.
-- ============================================================================

create table if not exists public.attendance_site_visits (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  attendance_id  uuid not null references public.employee_attendance(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete set null,  -- null = the Office
  arrived_at     timestamptz not null default now(),
  lat            double precision not null,
  lng            double precision not null,
  accuracy       real,
  selfie_path    text,
  outside_m      integer,
  outside_reason text,
  created_at     timestamptz default now()
);

create index if not exists attendance_site_visits_attendance_idx
  on public.attendance_site_visits (attendance_id, arrived_at);
create index if not exists attendance_site_visits_org_idx
  on public.attendance_site_visits (org_id, arrived_at desc);

alter table public.attendance_site_visits enable row level security;

-- Same privacy model as 0042 / 0045: self + super_admin/hr only. No
-- insert/update/delete policies: every write goes through switchSiteAction
-- using the service-role client, which gates itself.
drop policy if exists asv_read on public.attendance_site_visits;
create policy asv_read on public.attendance_site_visits for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

-- Addendum: "Office" as a site for SELECTED Site staff (e.g. sales execs).
-- Ticked per member on the Team page by super_admin. Such a member may pick
-- "Office" at check-in / Switch Site: the attendance row or visit is stored
-- with project_id = null (a visit with a null project = the Office) and
-- judged against the org office geofence. Pay, weekly-off and leave rules
-- still follow is_office (they stay Site).
alter table public.memberships
  add column if not exists can_work_from_office boolean not null default false;

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table public.attendance_site_visits;  (policy/indexes drop with it)
--   alter table public.memberships drop column if exists can_work_from_office;
-- Visit selfies stay in the attendance-selfies bucket as
-- <org>/<user>/<date>-visit-<n>.jpg; delete them there if needed.
-- ----------------------------------------------------------------------------
