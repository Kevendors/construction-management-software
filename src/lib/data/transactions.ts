import "server-only";

import type { Project, Transaction } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { mapProject, mapTransaction, type ProjectRow, type TransactionRow } from "./mappers";

// mock fallback
import { projects as mockProjects, transactions as mockTxns } from "@/lib/mock/data";

export interface LedgerRow {
  transaction: Transaction;
  project: Project | null;
}

export interface TransactionsLedger {
  rows: LedgerRow[];
  projects: Project[];
  totals: { in: number; out: number; net: number };
}

export async function getTransactionsLedger(): Promise<TransactionsLedger> {
  let transactions: Transaction[];
  let projects: Project[];

  if (!isSupabaseConfigured()) {
    transactions = mockTxns;
    projects = mockProjects;
  } else {
    const supabase = await createSupabase();
    const [t, p] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }),
      supabase.from("projects").select("*"),
    ]);
    if (t.error) throw t.error;
    if (p.error) throw p.error;
    transactions = (t.data as TransactionRow[]).map(mapTransaction);
    projects = (p.data as ProjectRow[]).map(mapProject);
  }

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const rows: LedgerRow[] = transactions.map((transaction) => ({
    transaction,
    project: projectById.get(transaction.projectId) ?? null,
  }));

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.direction === "in") acc.in += t.amount;
      else acc.out += t.amount;
      return acc;
    },
    { in: 0, out: 0, net: 0 }
  );
  totals.net = totals.in - totals.out;

  return { rows, projects, totals };
}
