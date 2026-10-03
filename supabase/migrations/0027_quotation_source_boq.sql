-- ----------------------------------------------------------------------------
-- 0027 — BOQ as a third quotation source
--
-- quotations.source (0023) was 'builder' | 'upload'. A client-supplied Bill
-- of Quantities goes through the exact same upload+extraction+review flow as
-- an uploaded quotation (src/app/quotations/upload/page.tsx) — only the
-- label differs ("BOQ received from [file]" vs "Uploaded from [file]"), so
-- this widens the existing check constraint rather than adding any new
-- columns or tables.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.quotations drop constraint if exists quotations_source_check;
alter table public.quotations
  add constraint quotations_source_check check (source in ('builder', 'upload', 'boq'));
