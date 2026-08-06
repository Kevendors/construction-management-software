-- ----------------------------------------------------------------------------
-- 0021 — Remember which invoice a quotation was converted into
--
-- Same shape as 0019's converted_project_id, for the same reason: without a
-- stored link the button re-offers itself forever and a second click raises a
-- duplicate invoice against the client.
--
-- on delete set null: deleting the invoice un-converts the quotation rather
-- than deleting it.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.quotations
  add column if not exists converted_invoice_id uuid
  references public.sales_invoices(id) on delete set null;

create index if not exists quotations_converted_invoice_id_idx
  on public.quotations (converted_invoice_id);
