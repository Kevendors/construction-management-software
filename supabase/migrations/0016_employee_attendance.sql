-- ============================================================================
-- 0016_employee_attendance.sql — per-employee GPS + selfie attendance
-- One row per user per day: check-in creates the row, check-out updates it.
-- The unique (org_id, user_id, date) index is the duplicate-check-in guard
-- (the app pre-checks and also catches 23505 on the race).
--
-- Also adds optional geo-fence columns to projects (all three null = fence
-- disabled). Selfies live in the PRIVATE storage bucket `attendance-selfies`
-- at ${org_id}/${user_id}/${date}-in.jpg / -out.jpg — the bucket must be
-- created manually in the Supabase dashboard (same as dpr-photos).
--
-- Visibility: employees see ONLY their own rows (selfie paths + GPS are
-- privacy-sensitive); super_admin and hr read org-wide. Requires 0002
-- (is_org_member/has_role) and 0008 (hr enum value). Safe to re-run.
-- ============================================================================

create table if not exists public.employee_attendance (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references orgs(id) on delete cascade,
  user_id            uuid not null references profiles(id) on delete cascade,
  project_id         uuid references projects(id) on delete set null,
  date               date not null,          -- org-local (IST) day, computed server-side
  check_in_at        timestamptz not null,
  check_in_lat       double precision,
  check_in_lng       double precision,
  check_in_accuracy  real,
  check_in_selfie_path  text,
  check_out_at       timestamptz,
  check_out_lat      double precision,
  check_out_lng      double precision,
  check_out_accuracy real,
  check_out_selfie_path text,
  status             text not null default 'present',
  total_minutes      integer,                -- set at check-out
  overtime_minutes   integer,                -- max(0, total - 480), set at check-out
  created_at         timestamptz not null default now()
);

create unique index if not exists employee_attendance_one_per_day
  on public.employee_attendance (org_id, user_id, date);
create index if not exists employee_attendance_org_date
  on public.employee_attendance (org_id, date);
create index if not exists employee_attendance_project
  on public.employee_attendance (project_id, date);

alter table public.employee_attendance enable row level security;

-- read: own rows for everyone; org-wide for super_admin + hr
drop policy if exists eatt_self_read on public.employee_attendance;
create policy eatt_self_read on public.employee_attendance for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists eatt_admin_read on public.employee_attendance;
create policy eatt_admin_read on public.employee_attendance for select to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','hr']));

-- write: users create and update only their own rows (check-in / check-out)
drop policy if exists eatt_self_insert on public.employee_attendance;
create policy eatt_self_insert on public.employee_attendance for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists eatt_self_update on public.employee_attendance;
create policy eatt_self_update on public.employee_attendance for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- optional per-project geo-fence (configured by super_admin in project Settings)
alter table public.projects
  add column if not exists geofence_lat double precision,
  add column if not exists geofence_lng double precision,
  add column if not exists geofence_radius_m integer;

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table if exists public.employee_attendance;
--   alter table public.projects
--     drop column if exists geofence_lat,
--     drop column if exists geofence_lng,
--     drop column if exists geofence_radius_m;
-- ----------------------------------------------------------------------------
