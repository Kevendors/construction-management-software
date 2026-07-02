import "server-only";

import type { Client, Project, Quotation } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import {
  mapClient,
  mapProject,
  mapQuotation,
  type ClientRow,
  type ProjectRow,
  type QuotationRow,
} from "./mappers";

// mock fallback
import { clients as mockClients, projects as mockProjects } from "@/lib/mock/data";
import { getClientQuotations as mockClientQuotations } from "@/lib/mock/selectors";

export async function getClients(): Promise<Client[]> {
  if (!isSupabaseConfigured()) return mockClients;
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").select("*").order("created_at");
  if (error) throw error;
  return (data as ClientRow[]).map(mapClient);
}

export interface ClientWithStats {
  client: Client;
  projectCount: number;
  totalValue: number;
}

export async function getClientsWithStats(): Promise<ClientWithStats[]> {
  if (!isSupabaseConfigured()) {
    return mockClients.map((client) => {
      const ps = mockProjects.filter((p) => p.clientId === client.id);
      return { client, projectCount: ps.length, totalValue: ps.reduce((s, p) => s + p.value, 0) };
    });
  }
  const supabase = await createSupabase();
  const [c, p] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("projects").select("client_id, value"),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  const clients = (c.data as ClientRow[]).map(mapClient);
  const projectRows = p.data as { client_id: string | null; value: number }[];
  return clients.map((client) => {
    const ps = projectRows.filter((x) => x.client_id === client.id);
    return {
      client,
      projectCount: ps.length,
      totalValue: ps.reduce((s, x) => s + Number(x.value), 0),
    };
  });
}

export async function getClientById(id: string): Promise<Client | null> {
  if (!isSupabaseConfigured()) return mockClients.find((c) => c.id === id) ?? null;
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapClient(data as ClientRow) : null;
}

export async function getAllClientIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return mockClients.map((c) => c.id);
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("clients").select("id");
  if (error) throw error;
  return (data as { id: string }[]).map((r) => r.id);
}

export async function getProjectsByClient(clientId: string): Promise<Project[]> {
  if (!isSupabaseConfigured()) return mockProjects.filter((p) => p.clientId === clientId);
  const supabase = await createSupabase();
  const { data, error } = await supabase.from("projects").select("*").eq("client_id", clientId);
  if (error) throw error;
  return (data as ProjectRow[]).map(mapProject);
}

export async function getClientQuotations(clientId: string): Promise<Quotation[]> {
  if (!isSupabaseConfigured()) return mockClientQuotations(clientId);
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("quotations")
    .select("*, quotation_items(*)")
    .eq("client_id", clientId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data as QuotationRow[]).map(mapQuotation);
}
