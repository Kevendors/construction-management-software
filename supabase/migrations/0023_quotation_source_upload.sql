-- ----------------------------------------------------------------------------
-- 0023 — Quotations prepared outside SiteHub
--
-- A quotation can now originate from an uploaded PDF/Excel rather than the
-- builder. The file itself lives in the `quotation-files` storage bucket
-- (created by hand in the dashboard, like project-files / dpr-photos /
-- attendance-selfies — buckets are not part of migrations); these columns
-- record where it is and how much of the extracted data still needs a human
-- eye.
--
-- extraction_review holds the extractor's own uncertainty, e.g.
--   {"lowConfidence": ["lines[3].rate", "gstRate"]}
-- so the review banner survives a reload and an unverified quote stays
-- visibly unverified.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.quotations
  add column if not exists source text not null default 'builder',
  add column if not exists source_file_path text,
  add column if not exists source_file_name text,
  add column if not exists extraction_review jsonb;

-- 'builder' = typed into SiteHub, 'upload' = extracted from a supplied file.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quotations_source_check'
  ) then
    alter table public.quotations
      add constraint quotations_source_check check (source in ('builder', 'upload'));
  end if;
end $$;
