import "server-only";

import type { Client, Project, Quotation, SalesInvoice } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapClient,
  mapInvoice,
  mapProject,
  mapQuotation,
  type ClientRow,
  type InvoiceRow,
  type ProjectRow,
  type QuotationRow,
} from "./mappers";
import { filterByProjectIds, getVisibleProjectIds } from "./team";

// mock fallback
import {
  clients as mockClients,
  projects as mockProjects,
  quotations as mockQuotations,
  salesInvoices as mockInvoices,
} from "@/lib/mock/data";

export interface QuotationView {
  quotation: Quotation;
  client: Client | null;
}

export async function getQuotationsView(): Promise<QuotationView[]> {
  if (!isSupabaseConfigured()) {
    return mockQuotations.map((quotation) => ({
      quotation,
      client: mockClients.find((c) => c.id === quotation.clientId) ?? null,
    }));
  }
  const supabase = await createSupabase();
  const [q, c] = await Promise.all([
    supabase.from("quotations").select("*, quotation_items(*)").order("date", { ascending: false }),
    supabase.from("clients").select("*"),
  ]);
  if (q.error) throw q.error;
  if (c.error) throw c.error;
  const clients = (c.data as ClientRow[]).map(mapClient);
  return (q.data as QuotationRow[]).map(mapQuotation).map((quotation) => ({
    quotation,
    client: clients.find((x) => x.id === quotation.clientId) ?? null,
  }));
}

export interface InvoiceView {
  invoice: SalesInvoice;
  client: Client | null;
  project: Project | null;
}

export async function getInvoicesView(): Promise<InvoiceView[]> {
  if (!isSupabaseConfigured()) {
    return mockInvoices.map((invoice) => ({
      invoice,
      client: mockClients.find((c) => c.id === invoice.clientId) ?? null,
      project: mockProjects.find((p) => p.id === invoice.projectId) ?? null,
    }));
  }
  const supabase = await createSupabase();
  const [i, c, p] = await Promise.all([
    supabase.from("sales_invoices").select("*, invoice_items(*)").order("date", { ascending: false }),
    supabase.from("clients").select("*"),
    supabase.from("projects").select("*"),
  ]);
  if (i.error) throw i.error;
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  const clients = (c.data as ClientRow[]).map(mapClient);
  const projects = (p.data as ProjectRow[]).map(mapProject);
  // Project-linked invoices are scoped to assigned projects for non-admins;
  // invoices without a project stay visible to the role group.
  const visible = await getVisibleProjectIds();
  return filterByProjectIds(
    (i.data as InvoiceRow[]).map(mapInvoice),
    visible,
    (x) => x.projectId
  ).map((invoice) => ({
    invoice,
    client: clients.find((x) => x.id === invoice.clientId) ?? null,
    project: projects.find((x) => x.id === invoice.projectId) ?? null,
  }));
}
