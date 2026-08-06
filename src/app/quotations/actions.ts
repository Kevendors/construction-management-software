"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { isLumpsum, type QuoteState } from "@/lib/quotation/compute";

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

/**
 * Persist a quotation (full state in payload + structured columns + line items).
 *
 * Pass `existingId` to update that quotation in place. Without it every save
 * inserts a new row, which is how one quote ended up saved several times under
 * the same number. Status is deliberately left untouched on update so re-saving
 * an already-sent or accepted quote doesn't silently knock it back to draft.
 */
export async function saveQuotationAction(
  state: QuoteState,
  grandTotal: number,
  existingId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };

  // Find or create a client from the quote's company / contact details.
  let clientId: string | null = null;
  const company = (state.company || state.clientName || "").trim();
  if (company) {
    // Match on company OR name. Quotes that fill in only a contact name are
    // stored with company = null, so a company-only lookup never matched them
    // and every save minted another duplicate client. Two sequential queries
    // rather than .or(), whose comma syntax breaks on names containing
    // commas, parentheses or ampersands.
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

    if (existingId) {
      clientId = existingId;
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

  const fields = {
    number: state.number || "—",
    client_id: clientId,
    project_name: state.quoteName || null,
    date: state.date,
    valid_until: state.validTill || null,
    tax_rate: state.gstRate || 0,
    payload: { ...state, grandTotal },
  };

  let quotationId: string;
  if (existingId) {
    const { data: updated, error: uErr } = await supabase
      .from("quotations")
      .update(fields)
      .eq("id", existingId)
      .select("id")
      .maybeSingle();
    if (uErr) return { error: uErr.message };
    // No row came back → RLS blocked it or the quote is gone.
    if (!updated) return { error: "That quotation no longer exists, or you can't edit it." };
    quotationId = updated.id as string;

    // Line ids are client-side only, so replace the set wholesale.
    const { error: dErr } = await supabase
      .from("quotation_items")
      .delete()
      .eq("quotation_id", quotationId);
    if (dErr) return { error: dErr.message };
  } else {
    const { data: quote, error: qErr } = await supabase
      .from("quotations")
      .insert({ org_id: orgId, status: "draft", ...fields })
      .select("id")
      .single();
    if (qErr) return { error: qErr.message };
    quotationId = quote.id as string;
  }

  // Line items — Amount = qty × rate.
  const items = state.lines.map((l) => ({
    org_id: orgId,
    quotation_id: quotationId,
    description: l.description,
    qty: isLumpsum(l) ? 1 : l.qty || 0,
    unit: l.unit,
    rate: l.rate || 0,
  }));
  if (items.length) {
    const { error: iErr } = await supabase.from("quotation_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  return { id: quotationId };
}

/** Load a saved quotation's full builder state for re-opening / editing. */
export async function getQuotationPayloadAction(id: string): Promise<QuoteState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("quotations").select("payload").eq("id", id).maybeSingle();
  return (data?.payload as QuoteState | undefined) ?? null;
}

export type QuotationStatus = "draft" | "sent" | "accepted" | "rejected";

/**
 * Record which project a quotation was converted into, so the list can offer
 * "View Project" instead of re-offering "Convert to Project" (a second click
 * used to create a duplicate project).
 *
 * Best-effort by design: it runs after the project already exists, so a failure
 * here must not surface as a project-creation error. Silently no-ops when
 * migration 0019 hasn't been applied yet (42703 = undefined column).
 */
export async function linkQuotationToProjectAction(
  quotationId: string,
  projectId: string
): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotations")
    .update({ converted_project_id: projectId })
    .eq("id", quotationId);
  if (error && error.code !== "42703") return { error: error.message };
  return { id: quotationId };
}

/**
 * Super-admin-only: permanently delete a quotation. `quotation_items` go with
 * it via the FK cascade, and nothing else in the schema references quotations,
 * so no rows are orphaned.
 *
 * Accepted quotes are refused — the client agreed to those and work may have
 * started, so removing one has to be a deliberate two-step (change the status
 * first). Migration 0018 narrows the DELETE policy to super_admin as well, so
 * this gate is enforced twice over.
 */
export async function deleteQuotationAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete a quotation." };

  const supabase = await createClient();
  const { data: quote, error: findErr } = await supabase
    .from("quotations")
    .select("id, number, status")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return { error: findErr.message };
  if (!quote) return { error: "That quotation no longer exists." };

  if (quote.status === "accepted") {
    return {
      error: "Accepted quotations can't be deleted. Change the status first if you really mean to remove it.",
    };
  }

  const { error } = await supabase.from("quotations").delete().eq("id", id);
  if (error) return { error: error.message };

  // The row is gone, so this log entry is the only remaining trace of it.
  await logActivity({
    action: "deleted",
    entityType: "quotation",
    entityId: id,
    summary: `Deleted quotation ${quote.number}`,
  });
  return { id };
}

/** Update a quotation's status (RLS-scoped — the org check happens in the policy). */
export async function updateQuotationStatusAction(
  id: string,
  status: QuotationStatus
): Promise<SaveResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  return { id };
}
