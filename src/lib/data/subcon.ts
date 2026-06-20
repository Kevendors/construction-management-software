import "server-only";

import type {
  MaterialIssue,
  MaterialItem,
  Project,
  RaBill,
  Subcontractor,
  SubconProgress,
  SubconWorkOrder,
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapMaterialIssue,
  mapMaterialItem,
  mapProject,
  mapRaBill,
  mapSubconProgress,
  mapSubcontractor,
  mapWorkOrder,
  type MaterialIssueRow,
  type MaterialItemRow,
  type ProjectRow,
  type RaBillRow,
  type SubconProgressRow,
  type SubcontractorRow,
  type SubconWorkOrderRow,
} from "./mappers";

// mock fallback
import {
  materialIssues as mockIssues,
  materialItems as mockItems,
  projects as mockProjects,
  raBills as mockRaBills,
  subconProgress as mockProgress,
  subconWorkOrders as mockWOs,
  subcontractors as mockSubs,
} from "@/lib/mock/data";

export interface SubconBoard {
  workOrders: SubconWorkOrder[];
  subcontractors: Subcontractor[];
  progress: SubconProgress[];
  raBills: RaBill[];
  materialIssues: MaterialIssue[];
  materialItems: MaterialItem[];
  projects: Project[];
}

export async function getSubconBoard(): Promise<SubconBoard> {
  if (!isSupabaseConfigured()) {
    return {
      workOrders: mockWOs,
      subcontractors: mockSubs,
      progress: mockProgress,
      raBills: mockRaBills,
      materialIssues: mockIssues,
      materialItems: mockItems,
      projects: mockProjects,
    };
  }
  const supabase = await createSupabase();
  const [wo, sc, pr, ra, mi, items, projects] = await Promise.all([
    supabase.from("subcon_work_orders").select("*, wo_items(*)").order("date", { ascending: false }),
    supabase.from("subcontractors").select("*").order("company"),
    supabase.from("subcon_progress").select("*"),
    supabase.from("ra_bills").select("*").order("date", { ascending: false }),
    supabase.from("material_issues").select("*").order("date", { ascending: false }),
    supabase.from("material_items").select("*"),
    supabase.from("projects").select("*"),
  ]);
  for (const res of [wo, sc, pr, ra, mi, items, projects]) if (res.error) throw res.error;
  return {
    workOrders: (wo.data as SubconWorkOrderRow[]).map(mapWorkOrder),
    subcontractors: (sc.data as SubcontractorRow[]).map(mapSubcontractor),
    progress: (pr.data as SubconProgressRow[]).map(mapSubconProgress),
    raBills: (ra.data as RaBillRow[]).map(mapRaBill),
    materialIssues: (mi.data as MaterialIssueRow[]).map(mapMaterialIssue),
    materialItems: (items.data as MaterialItemRow[]).map(mapMaterialItem),
    projects: (projects.data as ProjectRow[]).map(mapProject),
  };
}

export interface WorkOrderView {
  wo: SubconWorkOrder;
  subcontractor: Subcontractor | null;
  project: Project | null;
}

export async function getAllWorkOrderIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return mockWOs.map((w) => w.id);
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("subcon_work_orders").select("id");
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

export async function getWorkOrderView(id: string): Promise<WorkOrderView | null> {
  if (!isSupabaseConfigured()) {
    const wo = mockWOs.find((w) => w.id === id);
    if (!wo) return null;
    return {
      wo,
      subcontractor: mockSubs.find((s) => s.id === wo.subcontractorId) ?? null,
      project: mockProjects.find((p) => p.id === wo.projectId) ?? null,
    };
  }
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("subcon_work_orders")
    .select("*, wo_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const wo = mapWorkOrder(data as SubconWorkOrderRow);
  const [s, p] = await Promise.all([
    supabase.from("subcontractors").select("*").eq("id", wo.subcontractorId).maybeSingle(),
    supabase.from("projects").select("*").eq("id", wo.projectId).maybeSingle(),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  return {
    wo,
    subcontractor: s.data ? mapSubcontractor(s.data as SubcontractorRow) : null,
    project: p.data ? mapProject(p.data as ProjectRow) : null,
  };
}
