-- ============================================================================
-- 0017_attendance_admin_override.sql — admin/hr manual attendance correction
-- Employees self-verify via GPS + selfie (0016); this adds a narrow escape
-- hatch for super_admin/hr to mark or correct a record when self check-in
-- wasn't possible (dead phone, no signal, forgot). Manually-marked rows are
-- tagged `source = 'admin'` with who did it and why, so they stay visibly
-- distinct from self-verified attendance in the UI and the activity log.
-- Requires 0016. Safe to re-run (idempotent).
-- ============================================================================

alter table public.employee_attendance
  add column if not exists source text not null default 'self',
  add column if not exists marked_by uuid references profiles(id) on delete set null,
  add column if not exists note text;

-- write: super_admin/hr may insert or update ANY row in their org (self_insert/
-- self_update from 0016 remain — this is additive, not a replacement).
drop policy if exists eatt_admin_insert on public.employee_attendance;
create policy eatt_admin_insert on public.employee_attendance for insert to authenticated
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','hr']));

drop policy if exists eatt_admin_update on public.employee_attendance;
create policy eatt_admin_update on public.employee_attendance for update to authenticated
  using (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','hr']))
  with check (public.is_org_member(org_id) and public.has_role(org_id, array['super_admin','hr']));

-- ----------------------------------------------------------------------------
-- ROLLBACK:
--   drop policy if exists eatt_admin_insert on public.employee_attendance;
--   drop policy if exists eatt_admin_update on public.employee_attendance;
--   alter table public.employee_attendance
--     drop column if exists source,
--     drop column if exists marked_by,
--     drop column if exists note;
-- ----------------------------------------------------------------------------
