import "server-only";

import type { Client, Project, TaskStatus } from "@/lib/types";
import type { ProjectPnL } from "@/lib/mock/selectors";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { computeProjectPnL, computeTaskCompletion, computeTaskCounts } from "./compute";
import { filterByProjectIds, getVisibleProjectIds } from "./team";
import {
  mapBoq,
  mapClient,
  mapInvoice,
  mapProject,
  mapTask,
  mapTransaction,
  type BoqRow,
  type ClientRow,
  type InvoiceRow,
  type ProjectRow,
  type TaskRow,
  type TransactionRow,
} from "./mappers";

// mock fallback
import {
  boqs as mockBoqs,
  clients as mockClients,
  projects as mockProjects,
  salesInvoices as mockInvoices,
  tasks as mockTasks,
  transactions as mockTxns,
} from "@/lib/mock/data";

export interface ProjectOverview {
  project: Project;
  client: Client | null;
  pnl: ProjectPnL;
  taskCounts: Record<TaskStatus, number>;
}

export async function getProjectsOverview(): Promise<ProjectOverview[]> {
  if (!isSupabaseConfigured()) {
    return mockProjects.map((project) => {
      const client = mockClients.find((c) => c.id === project.clientId) ?? null;
      const txns = mockTxns.filter((t) => t.projectId === project.id);
      const invoices = mockInvoices.filter((i) => i.projectId === project.id);
      const boq = mockBoqs.find((b) => b.projectId === project.id) ?? null;
      const tasks = mockTasks.filter((t) => t.projectId === project.id);
      return {
        // percentComplete is auto-derived from task progress, not stored.
        project: { ...project, percentComplete: computeTaskCompletion(tasks) },
        client,
        pnl: computeProjectPnL(project, txns, invoices, boq),
        taskCounts: computeTaskCounts(tasks),
      };
    });
  }

  const supabase = await createSupabase();
  const [projectsRes, clientsRes, txnsRes, invoicesRes, boqsRes, tasksRes] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("sales_invoices").select("*, invoice_items(*)"),
    supabase.from("boqs").select("*, boq_items(*)"),
    supabase.from("tasks").select("*"),
  ]);
  for (const res of [projectsRes, clientsRes, txnsRes, invoicesRes, boqsRes, tasksRes]) {
    if (res.error) throw res.error;
  }

  const clients = (clientsRes.data as ClientRow[]).map(mapClient);
  const txns = (txnsRes.data as TransactionRow[]).map(mapTransaction);
  const invoices = (invoicesRes.data as InvoiceRow[]).map(mapInvoice);
  const boqs = (boqsRes.data as BoqRow[]).map(mapBoq);
  const tasks = (tasksRes.data as TaskRow[]).map(mapTask);

  // Non-super-admins only see projects they're assigned to (0010 mirrors in RLS).
  const visible = await getVisibleProjectIds();
  const visibleProjects = filterByProjectIds(
    (projectsRes.data as ProjectRow[]).map(mapProject),
    visible,
    (p) => p.id
  );

  return visibleProjects.map((project) => {
    const client = clients.find((c) => c.id === project.clientId) ?? null;
    const boq = boqs.find((b) => b.projectId === project.id) ?? null;
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    return {
      // percentComplete is auto-derived from task progress, not stored.
      project: { ...project, percentComplete: computeTaskCompletion(projectTasks) },
      client,
      pnl: computeProjectPnL(
        project,
        txns.filter((t) => t.projectId === project.id),
        invoices.filter((i) => i.projectId === project.id),
        boq
      ),
      taskCounts: computeTaskCounts(projectTasks),
    };
  });
}
