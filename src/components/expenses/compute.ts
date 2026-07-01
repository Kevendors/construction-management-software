import type { SupervisorLedgerEntry } from "@/lib/types";

export interface SupervisorBalance {
  supervisorId: string;
  received: number;
  paid: number;
  balance: number;
}

/** Group ledger entries per supervisor into received / paid / net balance. */
export function supervisorBalancesFrom(ledger: SupervisorLedgerEntry[]): SupervisorBalance[] {
  const ids = Array.from(new Set(ledger.map((l) => l.supervisorId)));
  return ids.map((supervisorId) => {
    const rows = ledger.filter((l) => l.supervisorId === supervisorId);
    const received = rows.filter((l) => l.direction === "received").reduce((s, l) => s + l.amount, 0);
    const paid = rows.filter((l) => l.direction === "paid").reduce((s, l) => s + l.amount, 0);
    return { supervisorId, received, paid, balance: received - paid };
  });
}
