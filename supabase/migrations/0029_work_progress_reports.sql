-- ----------------------------------------------------------------------------
-- 0029 — Work Progress Report (by KeyVendors)
--
-- A standalone, independently-authored narrative report — explicitly NOT
-- derived from or linked to the existing DPR feature (user decision). Formatted
-- like Quotation/Invoice with the Keyvendors letterhead, but no line items or
-- pricing: period, % complete, narrative sections, photos, signature.
--
-- Photos and signature are stored as resized data URLs directly inside
-- payload/photo_urls (no new storage bucket) — the same pattern this app
-- already uses for quotation/invoice signatures.
--
-- Treated as a Delivery/site-domain table — read/write roles copy
-- 0002_rbac.sql's own 'site' group (projects/dprs/...) verbatim.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

create table if not exists public.work_progress_reports (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.orgs(id) on delete cascade,
  number            text not null,
  project_id        uuid references public.projects(id) on delete set null,
  date              date not null,
  period_start      date,
  period_end        date,
  percent_complete  numeric,
  work_completed    text,
  next_plan         text,
  issues            text,
  photo_urls        text[],
  signature_url     text,
  payload           jsonb,
  created_at        timestamptz not null default now()
);

alter table public.work_progress_reports enable row level security;

drop policy if exists work_progress_reports_read on public.work_progress_reports;
create policy work_progress_reports_read on public.work_progress_reports
  for select using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'supervisor', 'staff', 'engineer', 'architect'])
  );

drop policy if exists work_progress_reports_write on public.work_progress_reports;
create policy work_progress_reports_write on public.work_progress_reports
  for all using (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'supervisor'])
  ) with check (
    is_org_member(org_id) and has_role(org_id, array['super_admin', 'pm', 'supervisor'])
  );

create index if not exists work_progress_reports_org_idx on public.work_progress_reports (org_id);
create index if not exists work_progress_reports_project_idx on public.work_progress_reports (project_id);
