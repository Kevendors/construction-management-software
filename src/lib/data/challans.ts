import "server-only";

import type { Challan, MaterialItem } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { getVisibleProjectIds, filterByProjectIds } from "./team";
import { mapChallan, mapMaterialItem, type ChallanRow, type MaterialItemRow } from "./mappers";

export interface ChallansBoard {
  challans: Challan[];
  projects: { id: string; name: string; location: string }[];
  materialItems: MaterialItem[];
}

export async function getChallansBoard(): Promise<ChallansBoard> {
  if (!isSupabaseConfigured()) return { challans: [], projects: [], materialItems: [] };
  const supabase = await createSupabase();

  const [challansRes, projectsRes, itemsRes] = await Promise.all([
    supabase.from("challans").select("*, challan_items(*)").order("date", { ascending: false }),
    supabase.from("projects").select("id, name, location"),
    supabase.from("material_items").select("*"),
  ]);

  // Tolerate 0030 not being applied yet — empty board rather than a hard
  // crash on every page load, same pattern as getPurchaseBillsBoard.
  if (challansRes.error) {
    if (challansRes.error.code === "42P01" || challansRes.error.code === "PGRST205") {
      return { challans: [], projects: [], materialItems: [] };
    }
    throw challansRes.error;
  }
  if (projectsRes.error) throw projectsRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const challans = (challansRes.data as ChallanRow[]).map(mapChallan);
  const visible = await getVisibleProjectIds();
  const scopedChallans = filterByProjectIds(challans, visible, (c) => c.projectId);
  const projectRows = projectsRes.data as { id: string; name: string; location: string | null }[];
  const scopedProjects = (visible ? projectRows.filter((p) => visible.includes(p.id)) : projectRows)
    .map((p) => ({ id: p.id, name: p.name, location: p.location ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    challans: scopedChallans,
    projects: scopedProjects,
    materialItems: (itemsRes.data as MaterialItemRow[]).map(mapMaterialItem),
  };
}
