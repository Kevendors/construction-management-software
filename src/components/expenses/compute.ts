import type { Expense, SupervisorLedgerEntry } from "@/lib/types";

export interface SupervisorBalance {
  supervisorId: string;
  allocated: number; // total imprest allocated by admin (received entries)
  spent: number; // that supervisor's approved petty expenses
  remaining: number; // allocated − spent
}

/**
 * Per-supervisor imprest balance: total allocated by admin minus their own
 * approved petty expenses. Only people with an allocation or approved spend
 * are returned.
 */
export function computeSupervisorBalances(
  ledger: SupervisorLedgerEntry[],
  expenses: Expense[]
): SupervisorBalance[] {
  const ids = new Set<string>();
  ledger.forEach((l) => l.supervisorId && ids.add(l.supervisorId));
  expenses.forEach((e) => {
    if (e.status === "approved" && e.byId) ids.add(e.byId);
  });

  return Array.from(ids)
    .map((supervisorId) => {
      const allocated = ledger
        .filter((l) => l.supervisorId === supervisorId && l.direction === "received")
        .reduce((s, l) => s + l.amount, 0);
      const spent = expenses
        .filter((e) => e.byId === supervisorId && e.status === "approved")
        .reduce((s, e) => s + e.amount, 0);
      return { supervisorId, allocated, spent, remaining: allocated - spent };
    })
    .filter((b) => b.allocated > 0 || b.spent > 0)
    .sort((a, b) => b.remaining - a.remaining);
}
