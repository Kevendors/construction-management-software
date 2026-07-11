import "server-only";

import type { Drawing, Project } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapDrawing,
  mapProject,
  type DrawingRow,
  type ProjectRow,
} from "./mappers";
import { filterByProjectIds, getVisibleProjectIds } from "./team";

// mock fallback
import { drawings as mockDrawings, projects as mockProjects } from "@/lib/mock/data";

export interface DesignBoard {
  groups: { project: Project; items: Drawing[] }[];
  counts: { total: number; approved: number; forReview: number; drafts: number };
}

function assemble(projects: Project[], drawings: Drawing[]): DesignBoard {
  return {
    groups: projects
      .map((project) => ({ project, items: drawings.filter((d) => d.projectId === project.id) }))
      .filter((g) => g.items.length > 0),
    counts: {
      total: drawings.length,
      approved: drawings.filter((d) => d.status === "approved").length,
      forReview: drawings.filter((d) => d.status === "for_review").length,
      drafts: drawings.filter((d) => d.status === "draft").length,
    },
  };
}

export async function getDesignBoard(): Promise<DesignBoard> {
  if (!isSupabaseConfigured()) return assemble(mockProjects, mockDrawings);

  const supabase = await createSupabase();
  const [d, p] = await Promise.all([
    supabase.from("drawings").select("*, drawing_versions(*)"),
    supabase.from("projects").select("*"),
  ]);
  if (d.error) throw d.error;
  if (p.error) throw p.error;
  // Non-super-admins only see drawings for projects they're assigned to.
  const visible = await getVisibleProjectIds();
  return assemble(
    filterByProjectIds((p.data as ProjectRow[]).map(mapProject), visible, (x) => x.id),
    filterByProjectIds((d.data as DrawingRow[]).map(mapDrawing), visible, (x) => x.projectId)
  );
}
