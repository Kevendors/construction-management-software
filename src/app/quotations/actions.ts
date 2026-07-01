"use server";

import { createClient } from "@/lib/supabase/server";
import type { QuoteState } from "@/lib/quotation/compute";

async function currentOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
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

/** Persist a quotation (full state in payload + structured columns + line items). */
export async function saveQuotationAction(
  state: QuoteState,
  grandTotal: number
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };

  // Find or create a client from the quote's company / contact details.
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
    if (existing) {
      clientId = existing.id as string;
    } else {
      const { data: created, error } = await supabase
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
      if (error) return { error: error.message };
      clientId = created.id as string;
    }
  }

  const { data: quote, error: qErr } = await supabase
    .from("quotations")
    .insert({
      org_id: orgId,
      number: state.number || "—",
      client_id: clientId,
      project_name: state.quoteName || null,
      date: state.date,
      valid_until: state.validTill || null,
      status: "draft",
      tax_rate: state.gstRate || 0,
      payload: { ...state, grandTotal },
    })
    .select("id")
    .single();
  if (qErr) return { error: qErr.message };

  // Line items — Amount = qty × rate.
  const items = state.lines.map((l) => ({
    org_id: orgId,
    quotation_id: quote.id,
    description: l.description,
    qty: l.qty || 0,
    unit: l.unit,
    rate: l.rate || 0,
  }));
  if (items.length) {
    const { error: iErr } = await supabase.from("quotation_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  return { id: quote.id as string };
}

/** Load a saved quotation's full builder state for re-opening / editing. */
export async function getQuotationPayloadAction(id: string): Promise<QuoteState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("payload").eq("id", id).maybeSingle();
  return (data?.payload as QuoteState | undefined) ?? null;
}
