"use server";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { MasterItem } from "@/lib/quotation/item-master";

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

interface OrgItemRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  uses_sqft: boolean;
}

const mapRow = (r: OrgItemRow): MasterItem => ({
  id: r.id,
  name: r.name,
  category: r.category,
  unit: r.unit as MasterItem["unit"],
  usesSqft: r.uses_sqft,
  description: r.name,
});

/**
 * An org's own additions to the item/service master — merge this with the
 * built-in ITEM_MASTER list in the Quotation/Invoice builders. Empty (never
 * throws) before 0031 is applied or when signed out, same tolerance pattern
 * as getQuotationSourceAction.
 */
export async function listOrgItemMasterAction(): Promise<MasterItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_item_master")
    .select("id, name, category, unit, uses_sqft")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as OrgItemRow[]).map(mapRow);
}

export interface CustomItemInput {
  /** The line's own text — becomes the master entry's name/description. */
  description: string;
  category?: string;
  unit: string;
  usesSqft: boolean;
}

/**
 * Save a document's custom (non-master) line items into the org's item
 * master, so they're available to pick next time — called after a
 * Quotation/Invoice save succeeds. De-duped case-insensitively per org
 * (the unique index is the real guard; this does a lookup first so a
 * re-save of the same document doesn't error on the conflict).
 *
 * Returns a lowercased-description -> master item id map so the caller can
 * re-point the saved lines' itemId at the new/matched master entries.
 */
export async function syncCustomItemsToMasterAction(
  items: CustomItemInput[]
): Promise<Record<string, string>> {
  if (!isSupabaseConfigured()) return {};
  const cleaned = items
    .map((i) => ({
      ...i,
      description: i.description.trim(),
      category: (i.category || "Civil & Misc").trim(),
    }))
    .filter((i) => i.description.length > 0);
  if (!cleaned.length) return {};

  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return {};

  const { data: existing, error: readErr } = await supabase
    .from("org_item_master")
    .select("id, name")
    .eq("org_id", orgId);
  if (readErr) return {};

  const map: Record<string, string> = {};
  const existingByName = new Map<string, string>(
    (existing as { id: string; name: string }[]).map((r) => [r.name.toLowerCase(), r.id])
  );

  const toInsert: { org_id: string; name: string; category: string; unit: string; uses_sqft: boolean }[] = [];
  const seenThisBatch = new Set<string>();
  for (const item of cleaned) {
    const key = item.description.toLowerCase();
    const existingId = existingByName.get(key);
    if (existingId) {
      map[key] = existingId;
    } else if (!seenThisBatch.has(key)) {
      seenThisBatch.add(key);
      toInsert.push({
        org_id: orgId,
        name: item.description,
        category: item.category,
        unit: item.unit || "NOS",
        uses_sqft: Boolean(item.usesSqft),
      });
    }
  }

  if (toInsert.length) {
    const { data: inserted, error: insErr } = await supabase
      .from("org_item_master")
      .insert(toInsert)
      .select("id, name");
    // Tolerate a race against a concurrent save of the same description
    // (unique index conflict) — fall through with whatever did insert;
    // the rest just won't get re-pointed this time, no data loss.
    if (!insErr && inserted) {
      for (const row of inserted as { id: string; name: string }[]) {
        map[row.name.toLowerCase()] = row.id;
      }
    }
  }

  return map;
}

export async function deleteOrgMasterItemAction(id: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "Signed out" };
  const { error } = await supabase
    .from("org_item_master")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  if (error) return { error: error.message };
  return {};
}
