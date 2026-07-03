import type {
  Advance,
  Employee,
  LabourAttendance,
  LabourContractor,
  Project,
  SalarySlip,
} from "@/lib/types";

export interface PayrollBoard {
  employees: Employee[];
  contractors: LabourContractor[];
  attendance: LabourAttendance[];
  advances: Advance[];
  slips: SalarySlip[];
  projects: Project[];
}

export interface SlipTotals {
  earnings: number;
  deductions: number;
  net: number;
}

export const slipTotals = (s: SalarySlip): SlipTotals => {
  const earnings = s.basic + s.hra + s.allowances;
  const deductions = s.pf + s.esi + s.advanceDeduction;
  return { earnings, deductions, net: earnings - deductions };
};

export const monthlyPayroll = (slips: SalarySlip[], month: string) =>
  slips.filter((s) => s.month === month).reduce((sum, s) => sum + slipTotals(s).net, 0);

export const payrollByDepartment = (
  slips: SalarySlip[],
  employees: Employee[],
  month: string
) => {
  const empById = new Map(employees.map((e) => [e.id, e]));
  const map = new Map<string, number>();
  for (const s of slips.filter((x) => x.month === month)) {
    const emp = empById.get(s.employeeId);
    if (!emp) continue;
    map.set(emp.department, (map.get(emp.department) ?? 0) + slipTotals(s).net);
  }
  return Array.from(map, ([department, amount]) => ({ department, amount }));
};

export const labourAttendanceByDay = (attendance: LabourAttendance[]) => {
  const map = new Map<string, { present: number; absent: number }>();
  for (const a of attendance) {
    const cur = map.get(a.date) ?? { present: 0, absent: 0 };
    cur.present += a.present;
    cur.absent += a.absent;
    map.set(a.date, cur);
  }
  return Array.from(map, ([date, v]) => ({ date, ...v })).sort(
    (a, b) => +new Date(a.date) - +new Date(b.date)
  );
};

export const latestAttendancePresent = (attendance: LabourAttendance[]) => {
  if (!attendance.length) return 0;
  const latest = attendance.reduce((m, a) => (a.date > m ? a.date : m), attendance[0].date);
  return attendance.filter((a) => a.date === latest).reduce((s, a) => s + a.present, 0);
};

export const advanceOutstanding = (a: { amount: number; recovered: number }) =>
  a.amount - a.recovered;

export const totalAdvancesOutstanding = (advances: Advance[]) =>
  advances.reduce((s, a) => s + advanceOutstanding(a), 0);

export const latestSlipMonth = (slips: SalarySlip[]) =>
  slips.reduce((m, s) => (s.month > m ? s.month : m), "");
