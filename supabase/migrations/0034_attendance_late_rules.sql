-- ============================================================================
-- 0034_attendance_late_rules.sql — Fractional Paid Days on Salary Slips
-- Modifies salary_slips.paid_days from integer to numeric to support half days
-- (e.g. 23.5 paid days from late arrival policies: 3 late arrivals allowed until
-- 10:15 AM; 4th late arrival onward or after 10:15 AM counted as half day).
-- ============================================================================

alter table public.salary_slips
  alter column paid_days type numeric;
