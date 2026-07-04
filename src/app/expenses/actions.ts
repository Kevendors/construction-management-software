"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { logActivity } from "@/lib/activity/log";
import { formatINR } from "@/lib/utils";
import type { ApprovalStatus } from "@/lib/types";

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
  category: string;
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

  await logActivity({
    action: "created",
    entityType: "expense",
    entityId: expenseId,
    summary: `Logged expense ${input.title ? `"${input.title}" ` : ""}of ${formatINR(input.amount)}`,
  });
  return { id: expenseId };
}

/** Approve or reject a pending expense — Super Admin only. */
export async function setExpenseStatus(
  id: string,
  status: Exclude<ApprovalStatus, "pending">
): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can approve or reject expenses." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("expenses")
    .update({ status, approver_id: ctx.userId })
    .eq("id", id);
  if (error) return { error: error.message };
  await logActivity({ action: status, entityType: "expense", entityId: id, summary: `Expense ${status}` });
  return { id };
}

/** Permanently delete a petty expense (and its bill) — Super Admin only. */
export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can delete expenses." };

  const supabase = await createClient();
  const { data: row } = await supabase.from("expenses").select("bill_path,title").eq("id", id).maybeSingle();

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  if (row?.bill_path) {
    const admin = createAdminClient();
    await admin.storage.from(BILL_BUCKET).remove([row.bill_path as string]);
  }
  await logActivity({ action: "deleted", entityType: "expense", entityId: id, summary: `Deleted expense ${row?.title ? `"${row.title}"` : ""}`.trim() });
  return { id };
}

/** Create a new cost code for the current org (idempotent by slug). */
export async function addCostCodeAction(label: string): Promise<CategoryResult> {
  const clean = label.trim();
  if (!clean) return { error: "Cost code name is required." };
  const slug = slugify(clean);
  if (!slug) return { error: "Enter a valid cost code name." };

  const supabase = await createClient();
  const { orgId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("cost_codes")
    .select("slug,label")
    .eq("org_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { slug: existing.slug as string, label: existing.label as string };

  const { data, error } = await supabase
    .from("cost_codes")
    .insert({ org_id: orgId, slug, label: clean })
    .select("slug,label")
    .single();
  if (error) return { error: error.message };
  return { slug: data.slug as string, label: data.label as string };
}

export interface AllocateBalanceInput {
  supervisorId: string;
  amount: number;
  date: string;
  note: string;
}

/** Allocate imprest balance to a supervisor (a 'received' ledger entry) — Super Admin only. */
export async function allocateBalanceAction(input: AllocateBalanceInput): Promise<ActionResult> {
  const ctx = await getAuthContext();
  if (!ctx || !isAdminRole(ctx.role)) return { error: "Only a Super Admin can allocate balance." };
  if (!ctx.orgId) return { error: "No organization found." };
  if (!input.supervisorId) return { error: "Select a supervisor." };
  if (!input.amount || input.amount <= 0) return { error: "Enter a valid amount." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("supervisor_ledger")
    .insert({
      org_id: ctx.orgId,
      supervisor_id: input.supervisorId,
      project_id: null,
      date: input.date,
      direction: "received",
      amount: input.amount,
      note: input.note.trim() || "Balance allocated",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "balance",
    entityId: data.id as string,
    summary: `Allocated ${formatINR(input.amount)} imprest balance`,
  });
  return { id: data.id as string };
}

export interface CategoryResult {
  slug?: string;
  label?: string;
  error?: string;
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Create a new expense category for the current org (idempotent by slug). */
export async function addExpenseCategoryAction(label: string): Promise<CategoryResult> {
  const clean = label.trim();
  if (!clean) return { error: "Category name is required." };
  const slug = slugify(clean);
  if (!slug) return { error: "Enter a valid category name." };

  const supabase = await createClient();
  const { orgId } = await currentContext(supabase);
  if (!orgId) return { error: "You must be signed in." };

  // Reuse an existing category with the same slug rather than erroring.
  const { data: existing } = await supabase
    .from("expense_categories")
    .select("slug,label")
    .eq("org_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return { slug: existing.slug as string, label: existing.label as string };

  const { data, error } = await supabase
    .from("expense_categories")
    .insert({ org_id: orgId, slug, label: clean })
    .select("slug,label")
    .single();
  if (error) return { error: error.message };
  return { slug: data.slug as string, label: data.label as string };
}
