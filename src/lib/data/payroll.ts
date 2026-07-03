import "server-only";

import type {
  Advance,
  Department,
  Employee,
  LabourAttendance,
  LabourContractor,
  Project,
  SalarySlip,
  Shift,
} from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { mapProject, type ProjectRow } from "./mappers";
import type { PayrollBoard } from "@/lib/payroll/compute";

// Re-export the client-safe compute helpers for existing import sites.
export type { PayrollBoard, SlipTotals } from "@/lib/payroll/compute";
export {
  slipTotals,
  monthlyPayroll,
  payrollByDepartment,
  labourAttendanceByDay,
  latestAttendancePresent,
  advanceOutstanding,
  totalAdvancesOutstanding,
  latestSlipMonth,
} from "@/lib/payroll/compute";

// mock fallback
import {
  advances as mockAdvances,
  employees as mockEmployees,
  labourAttendance as mockAttendance,
  labourContractors as mockContractors,
  projects as mockProjects,
  salarySlips as mockSlips,
} from "@/lib/mock/data";

interface EmployeeRow {
  id: string;
  name: string;
  designation: string | null;
  department: Department;
  monthly_ctc: number;
  join_date: string | null;
  phone: string | null;
  initials: string | null;
  avatar_color: string | null;
}
interface ContractorRow {
  id: string;
  name: string;
  company: string | null;
  trade: LabourContractor["trade"];
  phone: string | null;
  headcount: number;
  day_rate: number;
}
interface AttendanceRow {
  id: string;
  contractor_id: string | null;
  project_id: string | null;
  date: string;
  shift: Shift;
  present: number;
  absent: number;
  gps: string | null;
}
interface AdvanceRow {
  id: string;
  party_type: Advance["partyType"];
  party_id: string;
  date: string;
  amount: number;
  recovered: number;
  status: Advance["status"];
  note: string | null;
}
interface SlipRow {
  id: string;
  employee_id: string;
  month: string;
  paid_days: number;
  month_days: number;
  basic: number;
  hra: number;
  allowances: number;
  pf: number;
  esi: number;
  advance_deduction: number;
  status: SalarySlip["status"];
}

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

const mapEmployee = (r: EmployeeRow): Employee => ({
  id: r.id,
  name: r.name,
  designation: r.designation ?? "",
  department: r.department,
  monthlyCtc: Number(r.monthly_ctc),
  joinDate: r.join_date ?? "",
  phone: r.phone ?? "",
  initials: r.initials || initialsOf(r.name),
  avatarColor: r.avatar_color || "#64748b",
});
const mapContractor = (r: ContractorRow): LabourContractor => ({
  id: r.id,
  name: r.name,
  company: r.company ?? "",
  trade: r.trade,
  phone: r.phone ?? "",
  headcount: r.headcount,
  dayRate: Number(r.day_rate),
});
const mapAttendance = (r: AttendanceRow): LabourAttendance => ({
  id: r.id,
  contractorId: r.contractor_id ?? "",
  projectId: r.project_id ?? "",
  date: r.date,
  shift: r.shift,
  present: r.present,
  absent: r.absent,
  gps: r.gps ?? "",
});
const mapAdvance = (r: AdvanceRow): Advance => ({
  id: r.id,
  partyType: r.party_type,
  partyId: r.party_id,
  date: r.date,
  amount: Number(r.amount),
  recovered: Number(r.recovered),
  status: r.status,
  note: r.note ?? "",
});
const mapSlip = (r: SlipRow): SalarySlip => ({
  id: r.id,
  employeeId: r.employee_id,
  month: r.month,
  paidDays: r.paid_days,
  monthDays: r.month_days,
  basic: Number(r.basic),
  hra: Number(r.hra),
  allowances: Number(r.allowances),
  pf: Number(r.pf),
  esi: Number(r.esi),
  advanceDeduction: Number(r.advance_deduction),
  status: r.status,
});

export async function getPayrollBoard(): Promise<PayrollBoard> {
  if (!isSupabaseConfigured()) {
    return {
      employees: mockEmployees,
      contractors: mockContractors,
      attendance: mockAttendance,
      advances: mockAdvances,
      slips: mockSlips,
      projects: mockProjects,
    };
  }
  const supabase = await createSupabase();
  const [emp, con, att, adv, slp, pr] = await Promise.all([
    supabase.from("employees").select("*").order("name"),
    supabase.from("labour_contractors").select("*").order("company"),
    supabase.from("labour_attendance").select("*").order("date", { ascending: false }),
    supabase.from("advances").select("*").order("date", { ascending: false }),
    supabase.from("salary_slips").select("*"),
    supabase.from("projects").select("*"),
  ]);
  for (const r of [emp, con, att, adv, slp, pr]) if (r.error) throw r.error;
  return {
    employees: (emp.data as EmployeeRow[]).map(mapEmployee),
    contractors: (con.data as ContractorRow[]).map(mapContractor),
    attendance: (att.data as AttendanceRow[]).map(mapAttendance),
    advances: (adv.data as AdvanceRow[]).map(mapAdvance),
    slips: (slp.data as SlipRow[]).map(mapSlip),
    projects: (pr.data as ProjectRow[]).map(mapProject),
  };
}
