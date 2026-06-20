import "server-only";

import type { Equipment, Project } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapEquipment,
  mapProject,
  type EquipmentRow,
  type ProjectRow,
} from "./mappers";

// mock fallback
import { equipment as mockEquipment, projects as mockProjects } from "@/lib/mock/data";

export interface EquipmentCounts {
  total: number;
  inUse: number;
  idle: number;
  maintenance: number;
  monthlyCost: number;
}

const countEquipment = (items: Equipment[]): EquipmentCounts => ({
  total: items.length,
  inUse: items.filter((e) => e.status === "in_use").length,
  idle: items.filter((e) => e.status === "idle").length,
  maintenance: items.filter((e) => e.status === "maintenance").length,
  monthlyCost: items.reduce((s, e) => s + e.monthlyRate, 0),
});

export interface EquipmentBoard {
  items: Equipment[];
  counts: EquipmentCounts;
  projects: Project[];
}

export async function getEquipmentBoard(): Promise<EquipmentBoard> {
  if (!isSupabaseConfigured()) {
    return { items: mockEquipment, counts: countEquipment(mockEquipment), projects: mockProjects };
  }
  const supabase = await createSupabase();
  const [e, p] = await Promise.all([
    supabase.from("equipment").select("*").order("code"),
    supabase.from("projects").select("*"),
  ]);
  if (e.error) throw e.error;
  if (p.error) throw p.error;
  const items = (e.data as EquipmentRow[]).map(mapEquipment);
  return { items, counts: countEquipment(items), projects: (p.data as ProjectRow[]).map(mapProject) };
}
