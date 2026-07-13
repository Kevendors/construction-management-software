-- ============================================================================
-- 0011_remove_auto_assignment.sql — projects are NEVER assigned automatically
-- Drops the auto-enrol trigger that 0009 originally installed (PM + creator
-- were added to project_members on project insert). From here on the ONLY way
-- a user gets onto a project is the Super Admin assigning them via the Team
-- tab (project_members writes stay locked to super_admin by pmem_write).
--
-- Existing project_members rows are left untouched — remove any unwanted ones
-- from the project's Team tab. Safe to re-run (idempotent).
--
-- Note: a PM who creates a project will NOT see it after 0010 until the Super
-- Admin assigns them to it — that is the intended behavior.
-- ============================================================================

drop trigger if exists on_project_created on public.projects;
drop function if exists public.handle_project_created();
