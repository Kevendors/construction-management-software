"use server";

import { createClient } from "@/lib/supabase/server";
import { computeInvoice, isLumpsum, type InvoiceState } from "@/lib/invoice/compute";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { invoiceStatusMeta } from "@/lib/labels";
import { formatINR } from "@/lib/utils";

async function currentOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export interface SaveResult {
  id?: string;
  error?: string;
}

/** Create or update an invoice (full builder state in payload + line items). */
export async function saveInvoiceAction(
  state: InvoiceState,
  existingId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };

  const c = computeInvoice(state);

  // Find or create the client from the invoice's company/contact details.
  let clientId: string | null = null;
  const company = (state.company || state.clientName || "").trim();
  if (company) {
    // Match on company OR name: invoices that carry only a contact name are
    // stored with company = null, and a company-only lookup would never find
    // them again, minting a duplicate client on every save.
    const findBy = async (column: "company" | "name") => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("org_id", orgId)
        .ilike(column, company)
        .limit(1)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    };
    const existingId = (await findBy("company")) ?? (await findBy("name"));
    if (existingId) clientId = existingId;
    else {
      const { data: created } = await supabase
        .from("clients")
        .insert({
          org_id: orgId,
          name: state.clientName || company,
          company: state.company || null,
          email: state.email || null,
          phone: state.contact || null,
          address: state.address || null,
          gst: state.clientGstin || null,
        })
        .select("id")
        .single();
      clientId = created?.id ?? null;
    }
  }

  // Best-effort link to a project by name.
  let projectId: string | null = null;
  if (state.projectName?.trim()) {
    const { data: proj } = await supabase
      .from("projects")
      .select("id")
      .eq("org_id", orgId)
      .ilike("name", state.projectName.trim())
      .limit(1)
      .maybeSingle();
    projectId = proj?.id ?? null;
  }

  const base = {
    org_id: orgId,
    number: state.number || "—",
    client_id: clientId,
    project_id: projectId,
    date: state.date,
    due_date: state.dueDate || null,
    tax_rate: state.gstRate || 0,
    payload: { ...state, grandTotal: c.grandTotal },
  };

  let invoiceId: string;
  if (existingId) {
    // Status deliberately omitted on update — it's owned by the list's status
    // control and by payments. Writing it here reset every re-saved invoice
    // back to "sent".
    const { error } = await supabase.from("sales_invoices").update(base).eq("id", existingId);
    if (error) return { error: error.message };
    invoiceId = existingId;
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  } else {
    const { data, error } = await supabase
      .from("sales_invoices")
      .insert({ ...base, status: "draft" as const, received: 0 })
      .select("id")
      .single();
    if (error) return { error: error.message };
    invoiceId = data.id as string;
  }

  if (state.lines.length) {
    // Lumpsum lines have no meaningful quantity, so store 1 — everything
    // downstream computes qty × rate and must still land on the right figure.
    const items = state.lines.map((l) => ({
      org_id: orgId,
      invoice_id: invoiceId,
      description: l.description,
      qty: isLumpsum(l) ? 1 : l.qty || 0,
      unit: l.unit,
      rate: l.rate || 0,
    }));
    const { error: iErr } = await supabase.from("invoice_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  await logActivity({
    action: existingId ? "updated" : "created",
    entityType: "invoice",
    entityId: invoiceId,
    summary: `${existingId ? "Updated" : "Created"} invoice ${state.number || ""} (${formatINR(c.grandTotal)})`.trim(),
  });
  return { id: invoiceId };
}

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";

const INVOICE_STATUSES: InvoiceStatus[] = ["draft", "sent", "partial", "paid", "overdue"];

/**
 * Update an invoice's status (RLS-scoped — the org check happens in the policy).
 *
 * Pass `settleReceived` when marking an invoice paid to also record the
 * outstanding balance as received. Without it a manual "Mark Paid" leaves the
 * invoice reading Paid against ₹0 received, which is how INV-620 ended up
 * showing a full outstanding balance under a Paid badge. The total is computed
 * here from the stored line items rather than trusted from the client.
 */
export async function updateInvoiceStatusAction(
  id: string,
  status: InvoiceStatus,
  settleReceived = false
): Promise<SaveResult> {
  if (!INVOICE_STATUSES.includes(status)) return { error: "Unknown invoice status." };
  const supabase = await createClient();

  const update: { status: InvoiceStatus; received?: number } = { status };
  if (settleReceived && status === "paid") {
    const { data: inv } = await supabase
      .from("sales_invoices")
      .select("tax_rate, invoice_items(qty, rate)")
      .eq("id", id)
      .maybeSingle();
    if (inv) {
      const row = inv as unknown as { tax_rate: number | null; invoice_items?: { qty: number; rate: number }[] };
      const sub = (row.invoice_items ?? []).reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
      update.received = Math.round(sub * (1 + Number(row.tax_rate ?? 0) / 100) * 100) / 100;
    }
  }

  const { error } = await supabase.from("sales_invoices").update(update).eq("id", id);
  if (error) return { error: error.message };
  await logActivity({
    action: "updated",
    entityType: "invoice",
    entityId: id,
    summary: `Marked invoice ${invoiceStatusMeta[status]?.label ?? status}`,
  });
  return { id };
}

/**
 * Super-admin-only: permanently delete an invoice. `invoice_items` cascade with
 * it, and the only other reference is quotations.converted_invoice_id, which is
 * ON DELETE SET NULL — so the source quote simply becomes unconverted again.
 *
 * Paid and partially-paid invoices are refused: money has been received against
 * them and the row is the record of it. Migration 0022 narrows the DELETE
 * policy to super_admin as well, so this gate holds at both layers.
 */
export async function deleteInvoiceAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete an invoice." };

  const supabase = await createClient();
  const { data: inv, error: findErr } = await supabase
    .from("sales_invoices")
    .select("id, number, status, received")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!inv) return { error: "That invoice no longer exists." };

  if (inv.status === "paid" || inv.status === "partial") {
    return {
      error: "Paid and partly-paid invoices can't be deleted — they're the record of money received.",
    };
  }
  if (Number(inv.received) > 0) {
    return { error: "This invoice has payments recorded against it and can't be deleted." };
  }

  const { error } = await supabase.from("sales_invoices").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "invoice",
    entityId: id,
    summary: `Deleted invoice ${inv.number}`,
  });
  return { id };
}

/**
 * Load a saved invoice's builder state for re-opening / editing.
 *
 * Invoices raised outside the builder — the project Overview quick-add, seeds,
 * anything predating the payload column — have no payload. Returning null for
 * those made the builder open a *blank* form against a real invoice id, and
 * saving then overwrote the row: number reset to "—" and every line item
 * deleted. So fall back to rebuilding the state from the invoice's own columns
 * and line items.
 */
export async function getInvoicePayloadAction(id: string): Promise<InvoiceState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select(
      "payload, number, date, due_date, tax_rate, invoice_items(id, description, qty, unit, rate), clients(name, company, email, phone, address, gst), projects(name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const payload = data.payload as InvoiceState | undefined;
  if (payload) return payload;

  const row = data as unknown as {
    number: string | null;
    date: string;
    due_date: string | null;
    tax_rate: number | null;
    invoice_items?: { id: string; description: string; qty: number; unit: string | null; rate: number }[];
    clients?: { name?: string; company?: string; email?: string; phone?: string; address?: string; gst?: string } | null;
    projects?: { name?: string } | null;
  };

  return {
    clientName: row.clients?.name ?? "",
    company: row.clients?.company ?? "",
    address: row.clients?.address ?? "",
    siteLocation: "",
    clientGstin: row.clients?.gst ?? "",
    contact: row.clients?.phone ?? "",
    email: row.clients?.email ?? "",
    number: row.number ?? "",
    date: row.date,
    dueDate: row.due_date ?? "",
    projectName: row.projects?.name ?? "",
    taxMode: "intra",
    gstRate: Number(row.tax_rate ?? 0),
    discount: 0,
    lines: (row.invoice_items ?? []).map((it) => ({
      id: it.id,
      description: it.description,
      unit: it.unit ?? "LS",
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
      lumpsumMode: "none" as const,
    })),
    notes: "",
    terms: "",
  };
}
