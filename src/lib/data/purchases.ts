import "server-only";

import type { PurchaseBill } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { getVisibleProjectIds, filterByProjectIds } from "./team";
import { mapPurchaseBill, type PurchaseBillRow } from "./mappers";

export interface PurchaseBillsBoard {
  bills: PurchaseBill[];
}

export async function getPurchaseBillsBoard(): Promise<PurchaseBillsBoard> {
  if (!isSupabaseConfigured()) return { bills: [] };
  const supabase = await createSupabase();
  const { data, error } = await supabase
    .from("purchase_bills")
    .select("*, purchase_bill_items(*)")
    .order("date", { ascending: false });
  // Tolerate the migration not being applied yet (undefined table) the same
  // way quotations/upload-actions.ts tolerates 0023 not being applied —
  // empty board rather than a hard crash on every page load.
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { bills: [] };
    throw error;
  }
  const bills = (data as PurchaseBillRow[]).map(mapPurchaseBill);
  // Same project-scoped visibility every other commercial module applies
  // (invoices, quotations, transactions, …) — a non-admin only sees bills
  // for projects they're assigned to; unallocated bills stay visible.
  const visible = await getVisibleProjectIds();
  return { bills: filterByProjectIds(bills, visible, (b) => b.projectId) };
}
