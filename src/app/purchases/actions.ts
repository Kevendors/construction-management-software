"use server";

import { createClient } from "@/lib/supabase/server";
import { computeBill, isLumpsum, type BillState } from "@/lib/purchases/compute";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { purchaseBillStatusMeta } from "@/lib/labels";
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

/**
 * Create or update a purchase bill (full builder state in payload + line
 * items). Pass `sourcePoId` only on first save of a bill converted from a PO
 * — never touched on update, like status, so re-saving can't re-link it.
 */
export async function savePurchaseBillAction(
  state: BillState,
  grandTotal: number,
  existingId?: string | null,
  sourcePoId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };

  // Find or create the supplier from the bill's company/contact details.
  let supplierId: string | null = null;
  const company = (state.company || state.supplierName || "").trim();
  if (company) {
    // Match on company OR name, same two-query approach saveInvoiceAction
    // uses — a single .or() breaks on names containing commas/parentheses.
    const findBy = async (column: "company" | "name") => {
      const { data } = await supabase
        .from("suppliers")
        .select("id")
        .eq("org_id", orgId)
        .ilike(column, company)
        .limit(1)
        .maybeSingle();
      return (data?.id as string | undefined) ?? null;
    };
    const existingSupplierId = (await findBy("company")) ?? (await findBy("name"));
    if (existingSupplierId) supplierId = existingSupplierId;
    else {
      const { data: created } = await supabase
        .from("suppliers")
        .insert({
          org_id: orgId,
          name: state.supplierName || company,
          company: state.company || null,
          email: state.email || null,
          phone: state.contact || null,
          gst: state.supplierGstin || null,
          address: state.address || null,
        })
        .select("id")
        .single();
      supplierId = created?.id ?? null;
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

  const c = computeBill(state);
  const base = {
    org_id: orgId,
    number: state.number || "—",
    supplier_id: supplierId,
    project_id: projectId,
    date: state.date,
    due_date: state.dueDate || null,
    tax_rate: state.gstRate || 0,
    payload: { ...state, grandTotal: c.grandTotal },
  };

  let billId: string;
  if (existingId) {
    // status/paid deliberately omitted on update — owned by the list's
    // status control and payment recording, not by re-saving the builder.
    const { error } = await supabase.from("purchase_bills").update(base).eq("id", existingId);
    if (error) return { error: error.message };
    billId = existingId;
    await supabase.from("purchase_bill_items").delete().eq("bill_id", billId);
  } else {
    const { data, error } = await supabase
      .from("purchase_bills")
      .insert({
        ...base,
        status: "draft" as const,
        paid: 0,
        source_po_id: sourcePoId || null,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    billId = data.id as string;
  }

  if (state.lines.length) {
    const items = state.lines.map((l) => ({
      org_id: orgId,
      bill_id: billId,
      description: l.description,
      material_item_id: l.materialItemId || null,
      qty: isLumpsum(l) ? 1 : l.qty || 0,
      unit: l.unit,
      rate: l.rate || 0,
    }));
    const { error: iErr } = await supabase.from("purchase_bill_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  await logActivity({
    action: existingId ? "updated" : "created",
    entityType: "purchase_bill",
    entityId: billId,
    summary: `${existingId ? "Updated" : "Created"} purchase bill ${state.number || ""} (${formatINR(c.grandTotal)})`.trim(),
  });

  await dispatchNotification({
    orgId,
    roles: ["super_admin", "accountant"],
    kind: "payment",
    title: existingId ? `Purchase Bill Updated: ${state.number || "—"}` : `New Purchase Bill: ${state.number || "—"}`,
    body: `${state.supplierName ? `${state.supplierName} · ` : ""}${formatINR(c.grandTotal)}`,
    href: "/purchases",
  });

  return { id: billId };
}

export type PurchaseBillStatus = "draft" | "sent" | "partial" | "paid";
const BILL_STATUSES: PurchaseBillStatus[] = ["draft", "sent", "partial", "paid"];

/**
 * Update a purchase bill's status. Pass `settlePaid` when marking a bill
 * paid to also record the full outstanding amount as paid — mirrors
 * updateInvoiceStatusAction's settleReceived, same reasoning: a manual
 * "Mark Paid" with no settle would read Paid against ₹0 paid. The total is
 * computed here from the stored line items, not trusted from the client.
 */
export async function updatePurchaseBillStatusAction(
  id: string,
  status: PurchaseBillStatus,
  settlePaid = false
): Promise<SaveResult> {
  if (!BILL_STATUSES.includes(status)) return { error: "Unknown bill status." };
  const supabase = await createClient();

  const update: { status: PurchaseBillStatus; paid?: number } = { status };
  if (settlePaid && status === "paid") {
    const { data: bill } = await supabase
      .from("purchase_bills")
      .select("tax_rate, purchase_bill_items(qty, rate)")
      .eq("id", id)
      .maybeSingle();
    if (bill) {
      const row = bill as unknown as { tax_rate: number | null; purchase_bill_items?: { qty: number; rate: number }[] };
      const sub = (row.purchase_bill_items ?? []).reduce((s, it) => s + Number(it.qty) * Number(it.rate), 0);
      update.paid = Math.round(sub * (1 + Number(row.tax_rate ?? 0) / 100) * 100) / 100;
    }
  }

  const { error } = await supabase.from("purchase_bills").update(update).eq("id", id);
  if (error) return { error: error.message };

  const { data: billRow } = await supabase
    .from("purchase_bills")
    .select("org_id, number")
    .eq("id", id)
    .maybeSingle();

  await logActivity({
    action: "updated",
    entityType: "purchase_bill",
    entityId: id,
    summary: `Marked purchase bill ${purchaseBillStatusMeta[status]?.label ?? status}`,
  });

  if (billRow?.org_id) {
    await dispatchNotification({
      orgId: billRow.org_id as string,
      roles: ["super_admin", "accountant"],
      kind: status === "paid" ? "payment" : "info",
      title: `Purchase Bill ${status === "paid" ? "Paid" : purchaseBillStatusMeta[status]?.label ?? status}: ${billRow.number}`,
      body: `Status updated to ${purchaseBillStatusMeta[status]?.label ?? status}`,
      href: "/purchases",
    });
  }

  return { id };
}

/**
 * Super-admin-only: permanently delete a purchase bill. Paid and
 * partially-paid bills are refused — money has moved against them and the
 * row is the record of it.
 */
export async function deletePurchaseBillAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete a purchase bill." };

  const supabase = await createClient();
  const { data: bill, error: findErr } = await supabase
    .from("purchase_bills")
    .select("id, number, status, paid")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!bill) return { error: "That purchase bill no longer exists." };

  if (bill.status === "paid" || bill.status === "partial") {
    return { error: "Paid and partly-paid bills can't be deleted — they're the record of money paid." };
  }
  if (Number(bill.paid) > 0) {
    return { error: "This bill has payments recorded against it and can't be deleted." };
  }

  const { error } = await supabase.from("purchase_bills").delete().eq("id", id);
  if (error) return { error: error.message };

  await logActivity({
    action: "deleted",
    entityType: "purchase_bill",
    entityId: id,
    summary: `Deleted purchase bill ${bill.number}`,
  });
  return { id };
}

/**
 * Load a saved purchase bill's builder state for re-opening / editing.
 * Payload-first, falling back to reconstructing from columns + items for any
 * bill saved before the payload column existed — the same safety net
 * getInvoicePayloadAction has, kept here even though every bill should have
 * a payload from day one.
 */
export async function getPurchaseBillPayloadAction(id: string): Promise<BillState | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("purchase_bills")
    .select(
      "payload, number, date, due_date, tax_rate, purchase_bill_items(id, description, qty, unit, rate), suppliers(name, company, email, phone, address, gst), projects(name)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const payload = data.payload as BillState | undefined;
  if (payload) return payload;

  const row = data as unknown as {
    number: string | null;
    date: string;
    due_date: string | null;
    tax_rate: number | null;
    purchase_bill_items?: { id: string; description: string; qty: number; unit: string | null; rate: number }[];
    suppliers?: { name?: string; company?: string; email?: string; phone?: string; address?: string; gst?: string } | null;
    projects?: { name?: string } | null;
  };

  return {
    supplierName: row.suppliers?.name ?? "",
    company: row.suppliers?.company ?? "",
    address: row.suppliers?.address ?? "",
    supplierGstin: row.suppliers?.gst ?? "",
    contact: row.suppliers?.phone ?? "",
    email: row.suppliers?.email ?? "",
    number: row.number ?? "",
    date: row.date,
    dueDate: row.due_date ?? "",
    projectName: row.projects?.name ?? "",
    sourcePoId: null,
    taxMode: "intra",
    gstRate: Number(row.tax_rate ?? 0),
    discount: 0,
    lines: (row.purchase_bill_items ?? []).map((it) => ({
      id: it.id,
      description: it.description,
      unit: it.unit ?? "NOS",
      qty: Number(it.qty) || 0,
      rate: Number(it.rate) || 0,
      lumpsumMode: "none" as const,
    })),
    notes: "",
    terms: "",
  };
}
