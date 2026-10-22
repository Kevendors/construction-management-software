-- ============================================================================
-- 0045_attendance_spot_checks.sql — random location spot-checks for site staff.
-- At site check-in the app schedules one random check per 2-hour block; a
-- pg_cron job (below) calls /api/cron/spot-checks every 5 minutes to send due
-- checks as push notifications, expire unanswered ones (15 min) and alert
-- Super Admin/HR. See docs/superpowers/specs/2026-10-22-location-spot-checks-design.md
-- ============================================================================

create table if not exists public.attendance_spot_checks (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  attendance_id  uuid not null references public.employee_attendance(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  project_id     uuid references public.projects(id) on delete set null,
  scheduled_at   timestamptz not null,
  notified_at    timestamptz,
  was_notified   boolean,
  responded_at   timestamptz,
  lat            double precision,
  lng            double precision,
  accuracy       real,
  distance_m     real,
  status         text not null default 'scheduled'
                 check (status in ('scheduled','pending','on_site','off_site','confirmed','missed','excused','cancelled')),
  excused_by     uuid references public.profiles(id) on delete set null,
  excuse_note    text,
  created_at     timestamptz not null default now()
);

create index if not exists attendance_spot_checks_due_idx
  on public.attendance_spot_checks (status, scheduled_at);
create index if not exists attendance_spot_checks_attendance_idx
  on public.attendance_spot_checks (attendance_id);
create index if not exists attendance_spot_checks_user_idx
  on public.attendance_spot_checks (user_id, status);

alter table public.attendance_spot_checks enable row level security;

-- Same privacy model as 0042: self + super_admin/hr. An employee can NOT see
-- their own not-yet-fired ('scheduled') checks, or the random times would be
-- predictable. No insert/update/delete policies: every write goes through
-- server code using the service-role client, which gates itself.
drop policy if exists asc_read on public.attendance_spot_checks;
create policy asc_read on public.attendance_spot_checks for select to authenticated
  using (
    public.is_org_member(org_id)
    and (
      (user_id = auth.uid() and status <> 'scheduled')
      or public.has_role(org_id, array['super_admin','hr'])
    )
  );

-- ----------------------------------------------------------------------------
-- Scheduler. BEFORE RUNNING: replace both REPLACE_ME values —
--   REPLACE_ME_DOMAIN  → the live site domain, e.g. sitehub.example.com
--   REPLACE_ME_SECRET  → the exact CRON_SECRET value set in Vercel
-- Re-running this block updates the existing job (same name).
-- ----------------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'sitehub-spot-checks',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://REPLACE_ME_DOMAIN/api/cron/spot-checks',
    headers := jsonb_build_object(
      'Authorization', 'Bearer REPLACE_ME_SECRET',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   select cron.unschedule('sitehub-spot-checks');
--   drop table public.attendance_spot_checks;
-- ----------------------------------------------------------------------------
