-- ============================================================================
-- 0049_attendance_weekly_off_types.sql — weekly-off TYPES for site staff.
-- Requires 0047_attendance_weekly_off.sql (memberships.weekly_off_dow and
-- attendance_weekly_off_history). See
-- docs/superpowers/specs/2026-10-28-weekly-off-types-design.md
-- ----------------------------------------------------------------------------
-- Kinds:
--   fixed            — one weekday every week (weekly_off_dow; 0 = Sunday,
--                      the default "Every Sunday off"). Same as 0047.
--   alternate_sunday — every other Sunday: weekly_off_anchor is one off
--                      Sunday; Sundays an even number of weeks from it are off.
--   flexible         — no fixed off days; as many missed days as the month
--                      has Sundays count as weekly offs (computed in the app).
-- Pay is unchanged: a weekly off is never Absent and never a paid day. The
-- app treats missing columns as "fixed" until this is applied. Idempotent.
-- ============================================================================

-- Dependency guard: 0047 must already be applied.
do $$
begin
  if to_regclass('public.attendance_weekly_off_history') is null then
    raise exception 'Run 0047_attendance_weekly_off.sql first';
  end if;
end $$;

-- The member's CURRENT weekly-off type (+ anchor for alternate Sundays).
alter table public.memberships
  add column if not exists weekly_off_kind text not null default 'fixed';
alter table public.memberships
  add column if not exists weekly_off_anchor date;

-- Every change to the pattern (same history rows as 0047): a date uses the
-- latest row with effective_from <= date. Old rows default to 'fixed'.
alter table public.attendance_weekly_off_history
  add column if not exists kind text not null default 'fixed';
alter table public.attendance_weekly_off_history
  add column if not exists anchor date;

-- Named checks, added only when missing (re-running is safe).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'memberships_weekly_off_kind_check') then
    alter table public.memberships
      add constraint memberships_weekly_off_kind_check
      check (weekly_off_kind in ('fixed', 'alternate_sunday', 'flexible'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attendance_weekly_off_history_kind_check') then
    alter table public.attendance_weekly_off_history
      add constraint attendance_weekly_off_history_kind_check
      check (kind in ('fixed', 'alternate_sunday', 'flexible'));
  end if;
end $$;

-- RLS: unchanged — the 0047 read policies cover the new columns, and writes
-- still go only through service-role server actions (setWeeklyOffPatternAction).

-- ----------------------------------------------------------------------------
-- ROLLBACK (the app falls back to "fixed" for everyone):
--   alter table public.attendance_weekly_off_history drop constraint if exists attendance_weekly_off_history_kind_check;
--   alter table public.attendance_weekly_off_history drop column if exists anchor;
--   alter table public.attendance_weekly_off_history drop column if exists kind;
--   alter table public.memberships drop constraint if exists memberships_weekly_off_kind_check;
--   alter table public.memberships drop column if exists weekly_off_anchor;
--   alter table public.memberships drop column if exists weekly_off_kind;
-- Note: rolling back turns alternate / flexible members back into their
-- weekly_off_dow (0 = Sunday) for every date, including past ones.
-- ----------------------------------------------------------------------------
