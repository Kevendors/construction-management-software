-- ----------------------------------------------------------------------------
-- 0019 — Remember which project a quotation was converted into
--
-- "Convert to Project" handed values to the New Project dialog through
-- localStorage and kept no record, so an accepted quotation always re-offered
-- the button and a second click silently created a duplicate project. Store
-- the link so the UI can show "View Project" instead.
--
-- on delete set null: deleting the project leaves the quotation intact and
-- simply un-converts it.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.quotations
  add column if not exists converted_project_id uuid
  references public.projects(id) on delete set null;

create index if not exists quotations_converted_project_id_idx
  on public.quotations (converted_project_id);

-- Backfill note: quotations converted before this migration have no record of
-- it and stay null — they'll keep offering the button until converted again or
-- set by hand, e.g.
--   update public.quotations set converted_project_id =
--     (select id from public.projects where code = 'SH-011')
--   where number = '2173';
