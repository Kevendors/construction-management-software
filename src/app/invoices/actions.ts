"use server";

import { createClient } from "@/lib/supabase/server";
import { computeInvoice, type InvoiceState } from "@/lib/invoice/compute";

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
    const { data: existing } = await supabase
      .from("clients")
      .select("id")
      .eq("org_id", orgId)
      .ilike("company", company)
      .limit(1)
      .maybeSingle();
    if (existing) clientId = existing.id as string;
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
    status: "sent" as const,
    payload: { ...state, grandTotal: c.grandTotal },
  };

  let invoiceId: string;
  if (existingId) {
    const { error } = await supabase.from("sales_invoices").update(base).eq("id", existingId);
    if (error) return { error: error.message };
    invoiceId = existingId;
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
  } else {
    const { data, error } = await supabase
      .from("sales_invoices")
      .insert({ ...base, received: 0 })
      .select("id")
      .single();
    if (error) return { error: error.message };
    invoiceId = data.id as string;
  }

  if (state.lines.length) {
    const items = state.lines.map((l) => ({
      org_id: orgId,
      invoice_id: invoiceId,
      description: l.description,
      qty: l.qty || 0,
      unit: l.unit,
      rate: l.rate || 0,
    }));
    const { error: iErr } = await supabase.from("invoice_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  return { id: invoiceId };
}

/** Load a saved invoice's full builder state for re-opening / editing. */
export async function getInvoicePayloadAction(id: string): Promise<InvoiceState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("sales_invoices").select("payload").eq("id", id).maybeSingle();
  return (data?.payload as InvoiceState | undefined) ?? null;
}
