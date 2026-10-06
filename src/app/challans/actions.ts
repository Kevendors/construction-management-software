"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthContext } from "@/lib/auth/context";
import { dispatchNotification } from "@/lib/notifications/dispatch";

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

export interface ChallanLineState {
  id: string;
  materialItemId: string | null;
  description: string;
  qty: number;
  unit: string;
}

export interface ChallanState {
  number: string;
  projectId: string;
  date: string;
  vehicleNumber: string;
  transporterName: string;
  purposeNote: string;
  lines: ChallanLineState[];
}

export interface SaveResult {
  id?: string;
  error?: string;
}

/**
 * Persist a Challan (full state in payload + structured columns + item rows,
 * same pattern as quotations/invoices/purchase bills).
 */
export async function saveChallanAction(
  state: ChallanState,
  existingId?: string | null
): Promise<SaveResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in to save." };
  if (!state.projectId) return { error: "Choose a project first." };

  const fields = {
    number: state.number || "—",
    project_id: state.projectId,
    date: state.date,
    vehicle_number: state.vehicleNumber || null,
    transporter_name: state.transporterName || null,
    purpose_note: state.purposeNote || null,
    payload: state,
  };

  let challanId: string;
  if (existingId) {
    const { data, error } = await supabase
      .from("challans")
      .update(fields)
      .eq("id", existingId)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { error: "That challan no longer exists, or you can't edit it." };
    challanId = data.id as string;

    const { error: dErr } = await supabase.from("challan_items").delete().eq("challan_id", challanId);
    if (dErr) return { error: dErr.message };
  } else {
    const { data, error } = await supabase
      .from("challans")
      .insert({ org_id: orgId, ...fields })
      .select("id")
      .single();
    if (error) return { error: error.message };
    challanId = data.id as string;
  }

  const items = state.lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      org_id: orgId,
      challan_id: challanId,
      material_item_id: l.materialItemId,
      description: l.description,
      qty: l.qty || 0,
      unit: l.unit || null,
    }));
  if (items.length) {
    const { error: iErr } = await supabase.from("challan_items").insert(items);
    if (iErr) return { error: iErr.message };
  }

  const { data: proj } = await supabase.from("projects").select("name").eq("id", state.projectId).maybeSingle();
  const projName = (proj?.name as string | undefined) || "Project";
  await dispatchNotification({
    orgId,
    roles: ["super_admin", "pm", "supervisor"],
    kind: "stock",
    title: existingId ? `Challan Updated: ${state.number || "—"}` : `Delivery Challan: ${state.number || "—"}`,
    body: `Dispatched to ${projName} (${items.length} items)`,
    href: "/challans",
  });

  return { id: challanId };
}

/** Load a saved challan's full builder state for re-opening / editing. */
export async function getChallanPayloadAction(id: string): Promise<ChallanState | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("challans").select("payload").eq("id", id).maybeSingle();
  return (data?.payload as ChallanState | undefined) ?? null;
}

/** Super-admin/pm only (RLS-enforced) — permanently delete a challan. */
export async function deleteChallanAction(id: string): Promise<SaveResult> {
  const ctx = await getAuthContext();
  if (!ctx) return { error: "You must be signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("challans")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "That challan no longer exists, or you can't delete it." };
  return { id };
}
