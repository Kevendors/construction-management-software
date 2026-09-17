-- ----------------------------------------------------------------------------
-- 0024 — Proforma Invoice
--
-- A quotation can now convert to a Proforma Invoice, not just a Tax Invoice.
-- A PI is stored as an ordinary sales_invoices row (same table, same document
-- renderer) with is_proforma = true, so the row/RLS/delete machinery from
-- 0022 applies unchanged. The document component switches its title and the
-- list excludes proforma rows from the Raised/Received/Outstanding totals,
-- since a PI is not a real receivable.
--
-- proforma_source_id links a Tax Invoice back to the PI it was converted
-- from ("Convert to Tax Invoice"), the same way quotations track the
-- documents they became. ON DELETE SET NULL: deleting either side leaves the
-- other intact and just drops the link.
--
-- Safe to re-run. Apply in the Supabase SQL editor.
-- ----------------------------------------------------------------------------

alter table public.sales_invoices
  add column if not exists is_proforma boolean not null default false,
  add column if not exists proforma_source_id uuid
    references public.sales_invoices(id) on delete set null;

create index if not exists sales_invoices_is_proforma_idx
  on public.sales_invoices (is_proforma);
