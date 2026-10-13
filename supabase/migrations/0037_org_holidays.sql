-- ============================================================================
-- 0037_org_holidays.sql — Company holiday calendar
--
-- Admin-declared holidays (e.g. Gandhi Jayanti) that excuse attendance for a
-- given date without penalizing the employee as absent/late. `applies_to`
-- lets a holiday be office-staff-only (site/project staff still work and are
-- evaluated normally) or apply to everyone.
-- ============================================================================

create table if not exists public.org_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  date date not null,
  label text,
  applies_to text not null default 'office' check (applies_to in ('all', 'office')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, date)
);

alter table public.org_holidays enable row level security;

-- Writes go through createAdminClient() in src/app/attendance/actions.ts,
-- self-gated to super_admin/hr — same pattern as orgs.office_lat etc., which
-- also has no write RLS. Reads go through the ordinary cookie-wired client.
drop policy if exists org_holidays_read on public.org_holidays;
create policy org_holidays_read on public.org_holidays for select to authenticated
  using (public.is_org_member(org_id));
