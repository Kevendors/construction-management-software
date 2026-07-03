"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity/log";
import { formatINR } from "@/lib/utils";
import type {
  AdvanceParty,
  Department,
  SalarySlip,
  Shift,
  Trade,
} from "@/lib/types";

async function currentOrgId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
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

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

const AVATAR_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];
const pickColor = (seed: string) =>
  AVATAR_COLORS[Math.abs([...seed].reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length];

export interface AddEmployeeInput {
  name: string;
  designation: string;
  department: Department;
  monthlyCtc: number;
  joinDate: string;
  phone: string;
}

export async function addEmployeeAction(input: AddEmployeeInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.name.trim()) return { error: "Name is required." };

  const { data, error } = await supabase
    .from("employees")
    .insert({
      org_id: orgId,
      name: input.name.trim(),
      designation: input.designation.trim() || null,
      department: input.department,
      monthly_ctc: input.monthlyCtc || 0,
      join_date: input.joinDate || null,
      phone: input.phone.trim() || null,
      initials: initialsOf(input.name),
      avatar_color: pickColor(input.name),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "employee",
    entityId: data.id as string,
    summary: `Added employee ${input.name.trim()}`,
  });
  return { id: data.id as string };
}

export interface AddContractorInput {
  company: string;
  name: string;
  trade: Trade;
  phone: string;
  headcount: number;
  dayRate: number;
}

export async function addContractorAction(input: AddContractorInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.company.trim() && !input.name.trim()) return { error: "Company or contact name is required." };

  const { data, error } = await supabase
    .from("labour_contractors")
    .insert({
      org_id: orgId,
      name: input.name.trim() || input.company.trim(),
      company: input.company.trim() || null,
      trade: input.trade,
      phone: input.phone.trim() || null,
      headcount: input.headcount || 0,
      day_rate: input.dayRate || 0,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "contractor",
    entityId: data.id as string,
    summary: `Added labour contractor ${input.company.trim() || input.name.trim()}`,
  });
  return { id: data.id as string };
}

export interface MarkAttendanceInput {
  contractorId: string;
  projectId: string;
  date: string;
  shift: Shift;
  present: number;
  absent: number;
  gps: string;
}

export async function markAttendanceAction(input: MarkAttendanceInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.contractorId) return { error: "Contractor is required." };

  const { data, error } = await supabase
    .from("labour_attendance")
    .insert({
      org_id: orgId,
      contractor_id: input.contractorId,
      project_id: input.projectId || null,
      date: input.date,
      shift: input.shift,
      present: input.present || 0,
      absent: input.absent || 0,
      gps: input.gps.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "attendance",
    entityId: data.id as string,
    summary: `Marked attendance — ${input.present} present on ${input.date}`,
  });
  return { id: data.id as string };
}

export interface RecordAdvanceInput {
  partyType: AdvanceParty;
  partyId: string;
  date: string;
  amount: number;
  recovered: number;
  note: string;
}

export async function recordAdvanceAction(input: RecordAdvanceInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.partyId) return { error: "Party is required." };
  if (!input.amount) return { error: "Amount is required." };

  const recovered = Math.min(input.recovered || 0, input.amount);
  const status = recovered <= 0 ? "open" : recovered >= input.amount ? "cleared" : "settling";

  const { data, error } = await supabase
    .from("advances")
    .insert({
      org_id: orgId,
      party_type: input.partyType,
      party_id: input.partyId,
      date: input.date,
      amount: input.amount,
      recovered,
      status,
      note: input.note.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "advance",
    entityId: data.id as string,
    summary: `Recorded ${input.partyType} advance of ${formatINR(input.amount)}`,
  });
  return { id: data.id as string };
}

/** Generate a salary slip for an employee for a month from their CTC split. */
export async function generateSlipAction(
  employeeId: string,
  month: string,
  paidDays: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("monthly_ctc")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) return { error: empErr.message };
  if (!emp) return { error: "Employee not found." };

  const monthDays = 30;
  const days = Math.max(0, Math.min(paidDays || monthDays, monthDays));
  const ctc = Number(emp.monthly_ctc) || 0;
  const gross = Math.round((ctc * days) / monthDays);
  // Standard split: 50% basic, 20% HRA, 30% allowances; PF 12% of basic, ESI 0.75% of gross.
  const basic = Math.round(gross * 0.5);
  const hra = Math.round(gross * 0.2);
  const allowances = gross - basic - hra;
  const pf = Math.round(basic * 0.12);
  const esi = Math.round(gross * 0.0075);

  // Outstanding advance recovery for this employee (capped at 20% of gross).
  const { data: advs } = await supabase
    .from("advances")
    .select("amount,recovered")
    .eq("org_id", orgId)
    .eq("party_type", "employee")
    .eq("party_id", employeeId);
  const outstanding = (advs ?? []).reduce((s, a) => s + (Number(a.amount) - Number(a.recovered)), 0);
  const advanceDeduction = Math.min(outstanding, Math.round(gross * 0.2));

  // Replace any existing slip for this employee+month.
  await supabase.from("salary_slips").delete().eq("org_id", orgId).eq("employee_id", employeeId).eq("month", month);
  const { data, error } = await supabase
    .from("salary_slips")
    .insert({
      org_id: orgId,
      employee_id: employeeId,
      month,
      paid_days: days,
      month_days: monthDays,
      basic,
      hra,
      allowances,
      pf,
      esi,
      advance_deduction: advanceDeduction,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await logActivity({
    action: "created",
    entityType: "salary_slip",
    entityId: data.id as string,
    summary: `Generated salary slip for ${month}`,
  });
  return { id: data.id as string };
}

export async function setSlipStatusAction(
  id: string,
  status: SalarySlip["status"]
): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  const { error } = await supabase.from("salary_slips").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  return { id };
}
