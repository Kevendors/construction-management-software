"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { isEmployeeRole } from "@/lib/auth/roles";
import { logActivity } from "@/lib/activity/log";
import { assignEmployeeIdIfMissing } from "@/lib/team/employee-id";
import { formatINR } from "@/lib/utils";
import { SALARY_BASIS_DAYS } from "@/lib/payroll/compute";
import { expectedGross } from "@/lib/payroll/paid-days";
import type {
  AdvanceParty,
  Department,
  Role,
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
  deductPf?: boolean;
  deductEsi?: boolean;
  /** Optionally create a phone+password login for this employee (admin only). */
  createAccount?: boolean;
  accountPassword?: string;
  accountRole?: Role;
}

const phoneDigits = (phone: string) => phone.replace(/\D/g, "");

/** Departments that existed before 0051 (enum from 0001). */
const LEGACY_DEPARTMENTS: Department[] = ["engineering", "design", "site", "accounts", "admin"];
const DEPARTMENT_MIGRATION_MSG =
  "New departments need 0051_departments_client_visits.sql run in Supabase first.";

/** Before 0051 a new department value fails with a Postgres enum error — make it readable. */
const friendlyDepartmentError = (message: string) =>
  /invalid input value for enum/i.test(message) && /department/i.test(message)
    ? DEPARTMENT_MIGRATION_MSG
    : message;

export async function addEmployeeAction(input: AddEmployeeInput): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };
  if (!input.name.trim()) return { error: "Name is required." };

  // A new (0051) department on a DB without 0051 would fail the insert below — check first
  // (a read filter on the enum fails the same way) so no login account is left orphaned.
  if (!LEGACY_DEPARTMENTS.includes(input.department)) {
    const { error: deptErr } = await supabase
      .from("employees")
      .select("id")
      .eq("department", input.department)
      .limit(1);
    if (deptErr && /invalid input value for enum/i.test(deptErr.message)) {
      return { error: DEPARTMENT_MIGRATION_MSG };
    }
  }

  // Optionally provision a login account and link it to the employee row.
  let profileId: string | null = null;
  if (input.createAccount) {
    const ctx = await getAuthContext();
    if (!ctx || !isAdminRole(ctx.role)) return { error: "Only an admin can create login accounts." };
    // Payroll is for employees — client / subcontractor logins are created on Team & Roles.
    if (input.accountRole && !isEmployeeRole(input.accountRole)) return { error: "Choose an employee role for this login." };
    const digits = phoneDigits(input.phone);
    if (digits.length < 6) return { error: "A valid phone number is required to create a login." };
    if (!input.accountPassword || input.accountPassword.length < 6)
      return { error: "Account password must be at least 6 characters." };

    const admin = createAdminClient();
    const { data: created, error: acctErr } = await admin.auth.admin.createUser({
      email: `${digits}@sitehub.phone`,
      password: input.accountPassword,
      email_confirm: true,
      user_metadata: { name: input.name.trim(), phone: input.phone.trim() },
    });
    if (acctErr) return { error: acctErr.message };
    profileId = created.user?.id ?? null;
    if (!profileId) return { error: "Could not create the account." };

    await admin
      .from("profiles")
      .upsert({ id: profileId, name: input.name.trim(), initials: initialsOf(input.name) }, { onConflict: "id" });
    const { error: mErr } = await admin
      .from("memberships")
      .upsert(
        { org_id: orgId, user_id: profileId, role: input.accountRole ?? "supervisor", is_active: true },
        { onConflict: "org_id,user_id" }
      );
    if (mErr) return { error: mErr.message };
    // Same as Team & Roles: every employee login gets the next KV number.
    await assignEmployeeIdIfMissing(admin, orgId, profileId);
  }

  const insertPayload: Record<string, unknown> = {
    org_id: orgId,
    profile_id: profileId,
    name: input.name.trim(),
    designation: input.designation.trim() || null,
    department: input.department,
    monthly_ctc: input.monthlyCtc || 0,
    join_date: input.joinDate || null,
    phone: input.phone.trim() || null,
    initials: initialsOf(input.name),
    avatar_color: pickColor(input.name),
    deduct_pf: input.deductPf ?? true,
    deduct_esi: input.deductEsi ?? true,
  };

  let { data, error } = await supabase
    .from("employees")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && (error.message.includes("deduct_pf") || error.message.includes("deduct_esi"))) {
    delete insertPayload.deduct_pf;
    delete insertPayload.deduct_esi;
    const retry = await supabase.from("employees").insert(insertPayload).select("id").single();
    data = retry.data;
    error = retry.error;
  }
  if (error) return { error: friendlyDepartmentError(error.message) };
  if (!data) return { error: "Could not create employee record." };
  await logActivity({
    action: "created",
    entityType: "employee",
    entityId: data.id as string,
    summary: `Added employee ${input.name.trim()}${profileId ? " (with login account)" : ""}`,
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
  // Same roles that can reach Payroll (ROLE_MODULES); RLS still applies on top.
  const ctx = await getAuthContext();
  if (!ctx || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { error: "Only administrators and HR can generate salary slips." };
  }
  if (!Number.isFinite(paidDays)) return { error: "Invalid paid days." };

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("*")
    .eq("id", employeeId)
    .maybeSingle();
  if (empErr) return { error: empErr.message };
  if (!emp) return { error: "Employee not found." };

  // Fixed Day Basis: every month is 30 salary days, so per-day pay =
  // salary ÷ 30 and pay = salary − per-day × unpaid days.
  const monthDays = SALARY_BASIS_DAYS;
  // `paidDays` is a required number, including a legitimate 0 (zero attendance
  // that month) -- never substitute a default for it here (a `|| monthDays`
  // would silently turn a real 0 into a full month's pay).
  const days = Math.max(0, Math.min(paidDays, monthDays));
  // Same formula the Payroll Audit view checks against.
  const gross = expectedGross(Number(emp.monthly_ctc) || 0, days);
  // Full salary as basic pay (no HRA or allowances split)
  const basic = gross;
  const hra = 0;
  const allowances = 0;
  const deductPf = (emp as Record<string, unknown>).deduct_pf !== false;
  const deductEsi = (emp as Record<string, unknown>).deduct_esi !== false;
  const pf = deductPf ? Math.round(basic * 0.12) : 0;
  const esi = deductEsi ? Math.round(gross * 0.0075) : 0;

  // Outstanding advance recovery for this employee (capped at 20% of gross).
  const { data: advs } = await supabase
    .from("advances")
    .select("amount,recovered")
    .eq("org_id", orgId)
    .eq("party_type", "employee")
    .eq("party_id", employeeId);
  const outstanding = (advs ?? []).reduce((s, a) => s + (Number(a.amount) - Number(a.recovered)), 0);
  // Never negative (an over-recovered advance must not add pay).
  const advanceDeduction = Math.max(0, Math.min(outstanding, Math.round(gross * 0.2)));

  // Replace any existing slip for this employee+month.
  await supabase.from("salary_slips").delete().eq("org_id", orgId).eq("employee_id", employeeId).eq("month", month);
  const insertPayload: Record<string, unknown> = {
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
  };
  let { data, error } = await supabase
    .from("salary_slips")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error && error.code === "22P02") {
    // If the database paid_days column is integer and received a decimal (e.g. 23.5), round for DB insert
    insertPayload.paid_days = Math.round(days);
    const retry = await supabase.from("salary_slips").insert(insertPayload).select("id").single();
    data = retry.data;
    error = retry.error;
  }
  if (error) return { error: error.message };
  if (!data) return { error: "Could not create salary slip." };
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

export interface UpdateEmployeeSalaryInput {
  employeeId: string;
  monthlyCtc: number;
  designation?: string;
  department?: Department;
  phone?: string;
  deductPf?: boolean;
  deductEsi?: boolean;
}

/** Admin/HR only: update an employee's salary (monthly CTC) and job details. */
export async function updateEmployeeSalaryAction(
  input: UpdateEmployeeSalaryInput
): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const ctx = await getAuthContext();
  if (!ctx || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { error: "Only administrators and HR can set employee salaries." };
  }

  if (!input.employeeId) return { error: "Employee ID is required." };
  const monthlyCtc = Number(input.monthlyCtc);
  if (isNaN(monthlyCtc) || monthlyCtc < 0) {
    return { error: "Monthly CTC must be a non-negative number." };
  }

  const patch: Record<string, unknown> = {
    monthly_ctc: monthlyCtc,
  };
  if (input.designation !== undefined) patch.designation = input.designation.trim() || null;
  if (input.department !== undefined) patch.department = input.department;
  if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
  if (input.deductPf !== undefined) patch.deduct_pf = input.deductPf;
  if (input.deductEsi !== undefined) patch.deduct_esi = input.deductEsi;

  const admin = createAdminClient();
  let { data, error } = await admin
    .from("employees")
    .update(patch)
    .eq("id", input.employeeId)
    .eq("org_id", orgId)
    .select("id, name, monthly_ctc")
    .maybeSingle();

  if (error && (error.message.includes("deduct_pf") || error.message.includes("deduct_esi"))) {
    delete patch.deduct_pf;
    delete patch.deduct_esi;
    const retry = await admin
      .from("employees")
      .update(patch)
      .eq("id", input.employeeId)
      .eq("org_id", orgId)
      .select("id, name, monthly_ctc")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { error: friendlyDepartmentError(error.message) };
  if (!data) return { error: "Employee record not found." };

  await logActivity({
    action: "updated",
    entityType: "employee",
    entityId: input.employeeId,
    summary: `Set salary for ${data.name} to ${formatINR(monthlyCtc)}/month`,
  });

  return { id: data.id as string };
}

export async function deleteEmployeeAction(employeeId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const orgId = await currentOrgId(supabase);
  if (!orgId) return { error: "You must be signed in." };

  const ctx = await getAuthContext();
  if (!ctx || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { error: "Only administrators and HR can remove employees." };
  }

  const admin = createAdminClient();
  const { data: emp } = await admin
    .from("employees")
    .select("name")
    .eq("id", employeeId)
    .eq("org_id", orgId)
    .maybeSingle();

  const { error } = await admin
    .from("employees")
    .delete()
    .eq("id", employeeId)
    .eq("org_id", orgId);
  if (error) return { error: error.message };

  if (emp) {
    await logActivity({
      action: "deleted",
      entityType: "employee",
      entityId: employeeId,
      summary: `Removed employee ${emp.name} from payroll`,
    });
  }
  return { id: employeeId };
}

