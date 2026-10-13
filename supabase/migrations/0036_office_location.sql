-- ============================================================================
-- 0036_office_location.sql — shared office location for office-staff attendance
-- A single org-wide office geofence (all three null = fence disabled), same
-- convention as projects.geofence_lat/lng/radius_m (0016). Used by the new
-- one-tap office punch flow for employees with no project assignment.
-- Safe to re-run.
-- ============================================================================

alter table public.orgs
  add column if not exists office_lat numeric,
  add column if not exists office_lng numeric,
  add column if not exists office_radius_m integer;
