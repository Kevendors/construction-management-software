-- ============================================================================
-- 0039_manual_office_site.sql — Office/Site becomes an explicit per-member
-- setting (Super Admin, on the Team page), not an automatic inference from
-- project_members. This only affects the 1-paid-leave-per-month rule, the
-- office-only-holiday exclusion, and the Office/Site badge shown around the
-- app. It does NOT affect which check-in screen an employee sees (the
-- project-based GPS+selfie flow vs. the one-tap office flow) -- that still
-- depends on actual project assignment, since the GPS flow needs a real
-- project to attach attendance to.
--
-- Backfilled from today's auto-computed value (no project_members row =>
-- Office) so nobody's classification visibly changes the moment this ships;
-- a Super Admin can change it freely afterward.
-- ============================================================================

alter table memberships
  add column if not exists is_office boolean not null default true;

update memberships m
set is_office = not exists (
  select 1 from project_members pm where pm.user_id = m.user_id
)
where true;

-- ----------------------------------------------------------------------------
-- ROLLBACK: alter table memberships drop column if exists is_office;
-- ----------------------------------------------------------------------------
