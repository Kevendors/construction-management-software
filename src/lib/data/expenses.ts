import "server-only";

import type { Expense, Project, SupervisorLedgerEntry, User } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapProject, mapUser, type ProjectRow, type UserRow } from "./mappers";

const BILL_BUCKET = "expense-bills";

// mock fallback
import {
  expenses as mockExpenses,
  projects as mockProjects,
  supervisorLedger as mockLedger,
  users as mockUsers,
} from "@/lib/mock/data";

interface ExpenseRow {
  id: string;
  title: string | null;
  project_id: string | null;
  date: string;
  category: Expense["category"];
  cost_code: Expense["costCode"];
  amount: number;
  payment_mode: string | null;
  note: string | null;
  status: Expense["status"];
  by_id: string | null;
  bill_path: string | null;
}

interface LedgerRow {
  id: string;
  supervisor_id: string | null;
  project_id: string | null;
  date: string;
  direction: SupervisorLedgerEntry["direction"];
  amount: number;
  note: string | null;
}

const mapExpense = (r: ExpenseRow): Expense => ({
  id: r.id,
  title: r.title ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  category: r.category,
  costCode: r.cost_code,
  amount: Number(r.amount),
  paymentMode: r.payment_mode ?? "",
  note: r.note ?? "",
  status: r.status,
  byId: r.by_id ?? "",
  billPath: r.bill_path ?? "",
});

const mapLedger = (r: LedgerRow): SupervisorLedgerEntry => ({
  id: r.id,
  supervisorId: r.supervisor_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  direction: r.direction,
  amount: Number(r.amount),
  note: r.note ?? "",
});

export interface ExpensesBoard {
  expenses: Expense[];
  ledger: SupervisorLedgerEntry[];
  projects: Project[];
  users: User[];
}

export async function getExpensesBoard(): Promise<ExpensesBoard> {
  if (!isSupabaseConfigured()) {
    return { expenses: mockExpenses, ledger: mockLedger, projects: mockProjects, users: mockUsers };
  }
  const supabase = await createSupabase();
  const [ex, lg, pr, us] = await Promise.all([
    supabase.from("expenses").select("*").order("date", { ascending: false }),
    supabase.from("supervisor_ledger").select("*").order("date", { ascending: false }),
    supabase.from("projects").select("*"),
    supabase.from("profiles").select("*"),
  ]);
  for (const r of [ex, lg, pr, us]) if (r.error) throw r.error;
  const expenses = (ex.data as ExpenseRow[]).map(mapExpense);

  // Mint short-lived signed URLs for any uploaded bills (private bucket).
  const withBills = expenses.filter((e) => e.billPath);
  if (withBills.length) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from(BILL_BUCKET)
      .createSignedUrls(withBills.map((e) => e.billPath as string), 60 * 60 * 24 * 7);
    (signed ?? []).forEach((s, i) => {
      if (s.signedUrl && !s.error) withBills[i].billUrl = s.signedUrl;
    });
  }

  return {
    expenses,
    ledger: (lg.data as LedgerRow[]).map(mapLedger),
    projects: (pr.data as ProjectRow[]).map(mapProject),
    users: (us.data as UserRow[]).map(mapUser),
  };
}
