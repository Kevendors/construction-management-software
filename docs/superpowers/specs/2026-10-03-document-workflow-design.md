# Document workflow: BOQ, Work Order (client), Work Progress Report, Challan

## Context

User supplied an 8-document workflow table defining who originates each document. Four already
match the live app exactly (Quotation, Invoice, Proforma Invoice, Purchase Bill — all
KeyVendors-authored or vendor-authored as already built, no changes). The remaining four are new
or conflict with an existing same-named feature:

| Document | Party | Status |
|---|---|---|
| BOQ | By Client | New — client supplies this to KeyVendors |
| Work Order | By Client | New — conflicts with existing `SubconWorkOrder` (KeyVendors→Subcontractor), a *different* document at a different tier of the relationship |
| Work Progress Report | By KeyVendors | New |
| Challan | By KeyVendors | New |

Clarified over several rounds with the user (recorded here so the reasoning isn't lost):
"Bill → By Client" in the user's original message was a transcription of **"BOQ"** (Bill of
Quantities) — confirmed from a photo of the user's handwritten source notes.

## 1. BOQ

**Purpose:** record a client-supplied Bill of Quantities, then build a Quotation from it — the
same shape of work the existing "Upload Quotation" extraction flow already does.

**Design:** no new table, no new extraction code. `quotations.source` (migration 0023) gains a
third value: `'boq'` (alongside existing `'builder'`/`'upload'`) — requires widening its check
constraint. `/quotations/upload` gets a document-type choice (Quotation vs BOQ) before the file
picker; the choice only changes what `source` value `uploadQuotationFileAction` writes — the
extraction pipeline (`pdf.ts`/`excel.ts`/`rows.ts`/`line-heuristics.ts`) is untouched and runs
identically either way. The quotation builder's existing source chip
(`src/app/quotations/new/page.tsx`, the "Uploaded from" section) reads `source` and shows "BOQ
received from [filename]" instead of "Uploaded from [filename]" when `source === 'boq'`.

**Expected behavior, not a bug:** a BOQ typically lists quantities without rates, so more fields
land in the low-confidence review banner than a normal quotation upload — rate fields specifically.

## 2. Work Order (by Client)

**Purpose:** record-keeping proof that a client formally authorized work — does **not** drive any
status change or automation (explicit user decision).

**Design:** new table `quotation_work_orders` (id, org_id, quotation_id, file_path, file_name,
reference_number, date, note, created_at), one row per attached work order, FK'd to `quotations`.
Reuses the exact storage pattern `uploadQuotationFileAction` already established (same
`quotation-files` bucket, signed URLs) — a new sibling action
`uploadClientWorkOrderAction(quotationId, fileName, dataUrl, referenceNumber, date, note)`.
UI: an "Attach Work Order" button on the quotation card (`QuotationsList`) and/or inside the
builder, opening a small dialog (file + reference number + date + note) — modeled on
`DeleteQuotationDialog`'s dialog shape, not a full page. Once attached, shows as a chip with the
reference number and a link to the file, same visual language as the existing source-file chip.

## 3. Work Progress Report (by KeyVendors)

**Purpose:** a new, independently-authored document — not derived from DPR (explicit user
decision) — formatted like Quotation/Invoice with the Keyvendors letterhead.

**Design:** new table `work_progress_reports` (id, org_id, number, project_id, period_start,
period_end, percent_complete, work_completed text, next_plan text, issues text, photo_urls
text[], signature_url, payload jsonb, created_at) — payload-jsonb pattern like
quotations/invoices, no separate items table (no line items — this is a narrative report, not a
priced document). New route `/reports/work-progress` (list) + `/reports/work-progress/new` (builder), with a new
"Work Progress Reports" entry in the **Delivery** nav section (alongside Projects, Design
Management) — a top-level list like Quotations/Invoices get, not nested inside the project detail
page, consistent with how every other document type in this app has its own list+builder rather
than living inside a project tab. Builder mirrors
`src/app/quotations/new/page.tsx`'s structure minus line items: Project picker, period date
range, percent-complete number input, three textareas (work completed / next plan / issues),
photo upload (reusing `fileToResizedDataUrl`, same as the signature upload pattern elsewhere),
signature section (reuse `DEFAULT_SIGNATURE` pattern). Print document component
`work-progress-report-document.tsx` mirrors `invoice-document.tsx`'s letterhead chrome with a
narrative body instead of a line-item table.

## 4. Challan (Delivery/Dispatch)

**Purpose:** GST-compliant material dispatch record — goods moving to a project site without
being sold (no rate on line items).

**Design:** new tables `challans`/`challan_items` (challans: id, org_id, number, project_id,
date, vehicle_number, transporter_name, purpose_note, payload jsonb; challan_items: id, org_id,
challan_id, material_item_id, description, qty, unit — **no rate column**, deliberately, since
this is never a priced/sold transaction). New route `/challans` (list) + `/challans/new` (builder), with a new "Challans" nav entry in the
**Operations** section (alongside Material, Subcontractor, Equipment) — it's a goods-movement
record, not a money document, so it doesn't belong in Commercial. Builder is modeled on the
Purchase Bill builder's structure but with the item picker reading
`MaterialItem[]` from `src/lib/data/material.ts` (the Purchase Bill builder punted on an
item-master picker for v1 — Challan needs one, since "pick a material and its unit" is the whole
point here) and no Rate/Amount/GST section at all. Print document shows a "From: KeyVendors / To:
[Project site address]" header, vehicle/transporter line, and the item table (Description / Unit
/ Qty only) with a "Not for Sale — Goods sent for [purpose]" footer note.

## Build order

BOQ first (smallest — one column constraint change + one UI toggle, reuses everything). Then
Work Order (small — one table, one dialog). Then Work Progress Report and Challan (each a full
new document-type feature, comparable in size to the Purchase Bill module already built).

## Out of scope

- No automatic linkage between BOQ and Work Order (e.g., "this Work Order confirms that BOQ") —
  each attaches to a Quotation independently; relating them to each other wasn't asked for.
- Work Progress Report is not tied to or generated from DPR data, per explicit user decision —
  revisit only if asked later.
- Challan has no "convert from Purchase Order" or "convert from Goods Receipt" flow — items are
  picked fresh from the Material list each time; wasn't asked for and adds real scope.
- No client-facing portal/login changes — these documents are created and viewed by KeyVendors
  staff, same access model as every other document type in the app today.
