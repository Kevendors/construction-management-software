"use server";

import { createClient } from "@/lib/supabase/server";
import type { RAStatus, Trade, WOStatus } from "@/lib/types";

async function currentOrgId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("memberships")
    .select("org_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  return (data?.org_id as string | undefined) ?? null;
}

export interface ActionResult {
  id?: string;
  error?: string;
}

/* ------------------------------ Subcontractor ------------------------------ */

export interface SubcontractorInput {
  name: string;
  company: string;
  trade: Trade;
  contact: string;
  phone: string;
  gst: string;
}

export async function createSubcontractor(input: SubcontractorInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  const { data, error } = await supabase
    .from("subcontractors")
    .insert({
      org_id: orgId,
      name: input.name || input.company,
      company: input.company || null,
      trade: input.trade,
      contact: input.contact || null,
      phone: input.phone || null,
      gst: input.gst || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/* ------------------------------- Work Order -------------------------------- */

export interface WorkOrderItemInput {
  description: string;
  qty: number;
  unit: string;
  rate: number;
}

export interface WorkOrderInput {
  number: string;
  subcontractorId: string;
  projectId: string;
  date: string;
  status: WOStatus;
  taxRate: number;
  signatory: string;
  items: WorkOrderItemInput[];
}

export async function createWorkOrder(input: WorkOrderInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data: wo, error } = await supabase
    .from("subcon_work_orders")
    .insert({
      org_id: orgId,
      number: input.number,
      subcontractor_id: input.subcontractorId || null,
      project_id: input.projectId || null,
      date: input.date,
      status: input.status,
      tax_rate: input.taxRate || 0,
      signatory: input.signatory || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const items = input.items
    .filter((it) => it.description.trim())
    .map((it) => ({
      org_id: orgId,
      work_order_id: wo.id,
      description: it.description,
      qty: it.qty || 0,
      unit: it.unit || null,
      rate: it.rate || 0,
    }));
  if (items.length) {
    const { error: iErr } = await supabase.from("wo_items").insert(items);
    if (iErr) return { error: iErr.message };
  }
  return { id: wo.id as string };
}

/* -------------------------------- Progress --------------------------------- */

export interface ProgressInput {
  workOrderId: string;
  date: string;
  percent: number;
  note: string;
}

export async function logProgress(input: ProgressInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("subcon_progress")
    .insert({
      org_id: orgId,
      work_order_id: input.workOrderId,
      date: input.date,
      percent: input.percent,
      note: input.note || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  // Keep the work order status in step with progress.
  const newStatus: WOStatus | null =
    input.percent >= 100 ? "completed" : input.percent > 0 ? "in_progress" : null;
  if (newStatus) {
    await supabase.from("subcon_work_orders").update({ status: newStatus }).eq("id", input.workOrderId);
  }
  return { id: data.id as string };
}

/* --------------------------------- RA Bill --------------------------------- */

export interface RaBillInput {
  number: string;
  workOrderId: string;
  date: string;
  percentComplete: number;
  grossAmount: number;
  deductions: number;
  status: RAStatus;
}

export async function createRaBill(input: RaBillInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const net = Math.max(0, (input.grossAmount || 0) - (input.deductions || 0));
  const { data, error } = await supabase
    .from("ra_bills")
    .insert({
      org_id: orgId,
      number: input.number,
      work_order_id: input.workOrderId,
      date: input.date,
      percent_complete: input.percentComplete || 0,
      gross_amount: input.grossAmount || 0,
      deductions: input.deductions || 0,
      net_amount: net,
      status: input.status,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/* ----------------------------- Material Issue ------------------------------ */

export interface MaterialIssueInput {
  subcontractorId: string;
  projectId: string;
  materialItemId: string;
  qty: number;
  date: string;
}

export async function issueMaterial(input: MaterialIssueInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data, error } = await supabase
    .from("material_issues")
    .insert({
      org_id: orgId,
      subcontractor_id: input.subcontractorId || null,
      project_id: input.projectId || null,
      material_item_id: input.materialItemId || null,
      qty: input.qty || 0,
      date: input.date,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}
