-- ============================================================================
-- 0052_attendance_client_visits.sql — Start / End Visit: an Office member with
-- "Client visits allowed" logs each client visit made during an open shift
-- (client name, purpose, GPS + time at start and end). A record only: the
-- attendance day, pay, late and early check-out rules are untouched. Punching
-- out closes an open visit (auto_closed = true). The app treats this table as
-- "no visits" until it exists. Idempotent.
-- ============================================================================

create table if not exists public.attendance_client_visits (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  attendance_id     uuid not null references public.employee_attendance(id) on delete cascade,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  date              date not null,
  client_name       text not null,
  purpose           text not null,
  started_at        timestamptz not null default now(),
  start_lat         double precision not null,
  start_lng         double precision not null,
  start_accuracy    real,
  start_distance_m  integer,                        -- from the office; null = no office location set
  start_in_office   boolean not null default false, -- started inside the office fence (flagged to admin)
  ended_at          timestamptz,
  end_lat           double precision,
  end_lng           double precision,
  end_accuracy      real,
  end_distance_m    integer,
  auto_closed       boolean not null default false, -- closed by punch-out, not by the employee
  created_at        timestamptz default now()
);

-- At most one open visit per attendance day.
create unique index if not exists attendance_client_visits_one_open
  on public.attendance_client_visits (attendance_id) where ended_at is null;
create index if not exists attendance_client_visits_attendance_idx
  on public.attendance_client_visits (attendance_id, started_at);
create index if not exists attendance_client_visits_user_date_idx
  on public.attendance_client_visits (user_id, date desc);

alter table public.attendance_client_visits enable row level security;

-- Same privacy model as 0050: self + super_admin/hr only. No insert/update/
-- delete policies: every write goes through the server actions using the
-- service-role client, which gate themselves.
drop policy if exists acv_read on public.attendance_client_visits;
create policy acv_read on public.attendance_client_visits for select to authenticated
  using (
    public.is_org_member(org_id)
    and (user_id = auth.uid() or public.has_role(org_id, array['super_admin','hr']))
  );

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop table public.attendance_client_visits;  (policy/indexes drop with it)
-- ----------------------------------------------------------------------------
