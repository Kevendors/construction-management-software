-- ============================================================================
-- 0008_roles_enum.sql — the long-referenced "Migration A"
-- Extends the base `role` enum (0001 shipped only 7 values) and adds
-- memberships.is_active. 0002_rbac / 0006 already compare role::text, so
-- they work either way; this makes the new roles *storable*.
--
-- MUST stay isolated: a new enum value cannot be used in the same
-- transaction that adds it, and each migration file runs as one transaction.
-- Any statement referencing these values belongs in a later file.
-- Safe to re-run, and safe on a live DB where these were applied by hand.
-- ============================================================================

alter type role add value if not exists 'super_admin';
alter type role add value if not exists 'supervisor';
alter type role add value if not exists 'hr';
alter type role add value if not exists 'staff';
alter type role add value if not exists 'viewer';

alter table memberships add column if not exists is_active boolean not null default true;
