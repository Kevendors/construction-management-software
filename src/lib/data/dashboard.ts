import "server-only";

import type {
  Boq,
  Client,
  Project,
  SalesInvoice,
  Task,
  Transaction,
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  computeBudgetVsActual,
  computeCashFlow,
  computeCompanyTotals,
  computeMonthlyTrend,
  computePortfolioHealth,
  computeProjectMargins,
  enrichProjects,
  type EnrichedProject,
} from "./compute";
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

interface Portfolio {
  projects: Project[];
  clients: Client[];
  transactions: Transaction[];
  invoices: SalesInvoice[];
  boqs: Boq[];
  tasks: Task[];
}

/** Fetch every table the company-wide aggregates derive from, once. */
async function loadPortfolio(): Promise<Portfolio> {
  if (!isSupabaseConfigured()) {
    return {
      projects: mockProjects,
      clients: mockClients,
      transactions: mockTxns,
      invoices: mockInvoices,
      boqs: mockBoqs,
      tasks: mockTasks,
    };
  }
  const supabase = await createSupabase();
  const [p, c, t, i, b, tk] = await Promise.all([
    supabase.from("projects").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("transactions").select("*"),
    supabase.from("sales_invoices").select("*, invoice_items(*)"),
    supabase.from("boqs").select("*, boq_items(*)"),
    supabase.from("tasks").select("*"),
  ]);
  for (const res of [p, c, t, i, b, tk]) if (res.error) throw res.error;
  return {
    projects: (p.data as ProjectRow[]).map(mapProject),
    clients: (c.data as ClientRow[]).map(mapClient),
    transactions: (t.data as TransactionRow[]).map(mapTransaction),
    invoices: (i.data as InvoiceRow[]).map(mapInvoice),
    boqs: (b.data as BoqRow[]).map(mapBoq),
    tasks: (tk.data as TaskRow[]).map(mapTask),
  };
}

export interface PortfolioRow extends EnrichedProject {
  client: Client | null;
}

export interface CompanyDashboard {
  totals: ReturnType<typeof computeCompanyTotals>;
  trend: ReturnType<typeof computeMonthlyTrend>;
  flow: ReturnType<typeof computeCashFlow>;
  margins: ReturnType<typeof computeProjectMargins>;
  budget: ReturnType<typeof computeBudgetVsActual>;
  portfolio: PortfolioRow[];
}

export async function getCompanyDashboard(): Promise<CompanyDashboard> {
  const { projects, clients, transactions, invoices, boqs, tasks } = await loadPortfolio();
  const enriched = enrichProjects(projects, transactions, invoices, boqs, tasks);
  return {
    totals: computeCompanyTotals(projects, transactions, invoices),
    trend: computeMonthlyTrend(transactions, invoices),
    flow: computeCashFlow(transactions),
    margins: computeProjectMargins(enriched),
    budget: computeBudgetVsActual(enriched),
    portfolio: enriched.map((e) => ({
      ...e,
      client: clients.find((c) => c.id === e.project.clientId) ?? null,
    })),
  };
}

export interface CompanyAnalytics {
  health: ReturnType<typeof computePortfolioHealth>;
  trend: ReturnType<typeof computeMonthlyTrend>;
  flow: ReturnType<typeof computeCashFlow>;
  projects: Project[];
}

export async function getCompanyAnalytics(): Promise<CompanyAnalytics> {
  const { projects, transactions, invoices, boqs, tasks } = await loadPortfolio();
  const enriched = enrichProjects(projects, transactions, invoices, boqs, tasks);
  return {
    health: computePortfolioHealth(enriched),
    trend: computeMonthlyTrend(transactions, invoices),
    flow: computeCashFlow(transactions),
    projects,
  };
}
