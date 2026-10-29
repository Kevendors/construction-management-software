-- ============================================================================
-- 0051_departments_client_visits.sql — Departments, Designations & Office
-- "Client visits allowed". See
-- docs/superpowers/specs/2026-10-29-departments-client-visits-design.md
--
-- 1. More departments (HR labels only — they never decide Office vs Site,
--    which stays the explicit memberships.is_office Team setting).
-- 2. memberships.client_visits_allowed: an Office member may punch in/out
--    away from the office with a reason instead of being blocked by the
--    office fence. Super_admin ticks it on the Team page.
--
-- Existing employees, departments, roles and attendance are untouched.
-- The app tolerates this migration not being applied yet. Idempotent.
-- ============================================================================

-- 1. Department enum values. These come FIRST and are not used anywhere else
--    in this file (Postgres: a new enum value can't be used in the
--    transaction that adds it).
alter type public.department add value if not exists 'sales';
alter type public.department add value if not exists 'digital_marketing';
alter type public.department add value if not exists 'business_development';
alter type public.department add value if not exists 'hr';
alter type public.department add value if not exists 'projects';
alter type public.department add value if not exists 'it';
alter type public.department add value if not exists 'purchase';
alter type public.department add value if not exists 'others';

-- 2. Office "Client visits allowed" (default off = strict office fence, as today).
alter table public.memberships
  add column if not exists client_visits_allowed boolean not null default false;

comment on column public.memberships.client_visits_allowed is
  'Office members only: may punch in/out outside the office fence with a reason (client visits). Set by super_admin on the Team page.';
