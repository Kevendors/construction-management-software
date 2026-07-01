"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovalStatus, ExpenseCategory } from "@/lib/types";

const BILL_BUCKET = "expense-bills";

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

function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = /^data:(.+?);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) return null;
  const contentType = m[1];
  const ext =
    contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
}

export interface ActionResult {
  id?: string;
  error?: string;
}

export interface LogExpenseInput {
  title: string;
  projectId: string;
  byId: string; // person / employee (profile id)
  date: string;
  category: ExpenseCategory;
  amount: number;
  paymentMode: string;
  status: ApprovalStatus;
  note: string;
  billDataUrl?: string; // optional uploaded bill (data URL)
}

export async function logExpense(input: LogExpenseInput): Promise<ActionResult> {
  const supabase = await createClient();
  const { orgId, userId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.projectId) return { error: "Project is required." };
  if (!input.byId) return { error: "Employee / person is required." };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      org_id: orgId,
      title: input.title || null,
      project_id: input.projectId,
      by_id: input.byId,
      date: input.date,
      category: input.category,
      amount: input.amount,
      payment_mode: input.paymentMode || null,
      status: input.status,
      note: input.note || null,
      approver_id: input.status === "pending" ? null : userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const expenseId = data.id as string;

  // Upload the bill (if any) to the private bucket and record its path.
  if (input.billDataUrl) {
    const decoded = decodeDataUrl(input.billDataUrl);
    if (decoded) {
      const path = `${orgId}/${expenseId}.${decoded.ext}`;
      const admin = createAdminClient();
      const { error: upErr } = await admin.storage
        .from(BILL_BUCKET)
        .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: true });
      if (!upErr) {
        await supabase.from("expenses").update({ bill_path: path }).eq("id", expenseId);
      } else {
        console.error("[expenses] bill upload failed", upErr.message);
      }
    }
  }
  return { id: expenseId };
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
