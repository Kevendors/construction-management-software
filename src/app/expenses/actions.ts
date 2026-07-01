"use server";

import { createClient } from "@/lib/supabase/server";
import type { ApprovalStatus, CostCode, ExpenseCategory } from "@/lib/types";

async function currentContext(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { orgId: null, userId: null };
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return { orgId: (data?.org_id as string | undefined) ?? null, userId: user.id };
}

export interface ActionResult {
  id?: string;
  error?: string;
}

export interface LogExpenseInput {
  projectId: string;
  date: string;
  category: ExpenseCategory;
  costCode: CostCode;
  amount: number;
  note: string;
}

export async function logExpense(input: LogExpenseInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { orgId, userId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      project_id: input.projectId || null,
      date: input.date,
      category: input.category,
      cost_code: input.costCode,
      amount: input.amount,
      note: input.note || null,
      status: "pending",
      by_id: userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** Approve or reject a pending expense. */
export async function setExpenseStatus(
  id: string,
  status: Exclude<ApprovalStatus, "pending">
): Promise<ActionResult> {
  const supabase = await createClient();
  const { orgId, userId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("expenses")
    .update({ status, approver_id: userId })
    .eq("id", id);
  if (error) return { error: error.message };
  return { id };
}
