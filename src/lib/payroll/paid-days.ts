// Client-safe, pure: how many salary days an employee is paid for a month.
// The ONE implementation shared by the Staff Payroll Generate / Recalc
// buttons, the Set Salary dialog's draft recalc and the Payroll Audit view —
// so the slip and the audit can never disagree.

import {
  daysOfMonth,
  monthlySummary,
  type AttendanceAdminBoard,
  type AttendanceMember,
  type MonthlySummary,
  type OrgHoliday,
  type WeekOffRule,
  SUNDAY_OFF,
} from "@/lib/attendance/compute";
import { isOfficeDepartment, SALARY_BASIS_DAYS } from "@/lib/payroll/compute";
import type { Employee, EmployeeAttendance } from "@/lib/types";

/**
 * Salary days of `month` earned so far (Fixed Day Basis, max 30): the full 30
 * once the month is over, today's day-of-month (capped at 30) while it's in
 * progress, 0 for a future month.
 */
export function daysElapsedIn(month: string, today: string): number {
  if (month < today.slice(0, 7)) return SALARY_BASIS_DAYS;
  if (month === today.slice(0, 7)) return Math.min(SALARY_BASIS_DAYS, Number(today.slice(8, 10)));
  return 0;
}

export interface MemberMatch {
  member: AttendanceMember | undefined;
  /** How the attendance member was found — "profile" (linked login) or "name" (unlinked, unique name). */
  matchedBy: "profile" | "name" | null;
  /** True when an unlinked employee's name matched 2+ attendance members — none is used (never guess whose attendance pays whom). */
  ambiguous: boolean;
}

/**
 * The attendance member behind a payroll employee. A linked login
 * (`profileId`) is authoritative and is the only key used when present — a
 * namesake can never stand in for it. Unlinked employees fall back to an
 * exact (case-insensitive) name match, but only against members no other
 * employee is linked to, and only when exactly one such member has the name.
 */
export function matchAttendanceMember(
  emp: Employee,
  members: AttendanceMember[],
  employees: Employee[] = []
): MemberMatch {
  if (emp.profileId) {
    const m = members.find((x) => x.userId === emp.profileId);
    return { member: m, matchedBy: m ? "profile" : null, ambiguous: false };
  }
  const claimed = new Set(employees.filter((e) => e.id !== emp.id && e.profileId).map((e) => e.profileId as string));
  const name = emp.name.trim().toLowerCase();
  const byName = members.filter((x) => !claimed.has(x.userId) && x.name.trim().toLowerCase() === name);
  if (byName.length === 1) return { member: byName[0], matchedBy: "name", ambiguous: false };
  return { member: undefined, matchedBy: null, ambiguous: byName.length > 1 };
}

export interface MemberPaidDays {
  /** The member's attendance rows in the month (any status). */
  recordCount: number;
  /** monthlySummary for the month. */
  summary: MonthlySummary;
  /** Salary days elapsed (daysElapsedIn). */
  daysElapsed: number;
  /** Absent + 0.5 × Half-Day + Not Joined. */
  unpaidDays: number;
  /** Salary days to pay (0…30). 0 when there's no attendance at all this month. */
  paidDays: number;
  /** True when the member has no attendance rows this month (paidDays forced to 0). */
  noAttendance: boolean;
}

/**
 * Paid days for ONE attendance member from their own records — the single
 * formula behind payroll, the admin attendance grid total and the My
 * Attendance "Paid Days (salary)" chip (Fixed Day Basis):
 * paidDays = max(0, daysElapsed − (Absent + 0.5 × Half-Day + Not Joined)).
 * A member with no attendance rows at all this month gets 0 (deliberate: a
 * missing month must never silently become pay). `records` may contain other
 * months; only `month`'s rows are used.
 */
export function paidDaysFromRecords(input: {
  records: EmployeeAttendance[];
  month: string;
  today: string;
  holidays: OrgHoliday[];
  isOffice: boolean;
  weekOff?: WeekOffRule;
  startDate?: string;
}): MemberPaidDays {
  const records = input.records.filter((r) => r.date.startsWith(input.month));
  const summary = monthlySummary(records, input.month, input.today, input.holidays, input.isOffice, input.weekOff, input.startDate);
  const daysElapsed = daysElapsedIn(input.month, input.today);
  const unpaidDays = summary.absent + summary.halfDay * 0.5 + summary.notJoined;
  const noAttendance = records.length === 0;
  return {
    recordCount: records.length,
    summary,
    daysElapsed,
    unpaidDays,
    paidDays: noAttendance ? 0 : Math.max(0, daysElapsed - unpaidDays),
    noAttendance,
  };
}

export const ATTENDANCE_NOT_LOADED_MSG = "Attendance data didn't load — refresh and try again.";
export const ATTENDANCE_INCOMPLETE_MSG = "Attendance data didn't fully load — refresh and try again.";

/**
 * Why the attendance board can't be used for pay at all, or null when it's
 * fine: missing, empty (no members or no records) while there are employees
 * to pay, or flagged `incomplete` (holidays / profiles query failed).
 */
export function attendanceBoardProblem(board: AttendanceAdminBoard | undefined, employeeCount: number): string | null {
  if (!board) return ATTENDANCE_NOT_LOADED_MSG;
  if (employeeCount > 0 && (board.members.length === 0 || board.records.length === 0)) return ATTENDANCE_NOT_LOADED_MSG;
  if (board.incomplete) return ATTENDANCE_INCOMPLETE_MSG;
  return null;
}

export interface PaidDaysResult extends MemberMatch {
  /** Paid from attendance rows (a roster member, or a linked login's orphaned rows). Untracked = full 30 days. */
  tracked: boolean;
  /** Office/Site used for the calculation; null when untracked / blocked. */
  isOffice: boolean | null;
  /** The employee's attendance rows in the month (any status). */
  recordCount: number;
  /** monthlySummary for the month — null when untracked / blocked. */
  summary: MonthlySummary | null;
  /** Salary days elapsed (daysElapsedIn). */
  daysElapsed: number;
  /** Absent + 0.5 × Half-Day + Not Joined. */
  unpaidDays: number;
  /** Salary days to pay (0…30). Meaningless (0) when `blocked`. */
  paidDays: number;
  /** Tracked but no attendance rows this month — paid 0 (deliberate). */
  noAttendance: boolean;
  /** `profileId` is set but that login isn't an attendance member (deactivated / recreated). */
  linkedMissing: boolean;
  /** Why no slip may be generated for this employee (never fall back to 30 days), or null. */
  blocked: string | null;
  /** Calendar days in the month (28–31) — for the day-bucket check, not pay. */
  daysInMonth: number;
}

/**
 * Paid days for one payroll employee in `month`:
 * - matched attendance member → paidDaysFromRecords on their own rows;
 * - linked login (`profileId`) with no member but rows this month → those
 *   rows with defaults (Office/Site from the department group, Sunday off,
 *   no start date); with no rows → blocked;
 * - unlinked name matching 2+ members → blocked;
 * - unlinked, no match → untracked, full 30.
 * Callers must also refuse when attendanceBoardProblem() is non-null.
 */
export function paidDaysFor(
  emp: Employee,
  board: AttendanceAdminBoard | undefined,
  month: string,
  today: string,
  employees: Employee[] = []
): PaidDaysResult {
  const match = matchAttendanceMember(emp, board?.members ?? [], employees);
  const daysInMonth = daysOfMonth(month).length;
  const daysElapsed = daysElapsedIn(month, today);
  const untracked = (paidDays: number, extra: Partial<PaidDaysResult> = {}): PaidDaysResult => ({
    ...match,
    tracked: false,
    isOffice: null,
    recordCount: 0,
    summary: null,
    daysElapsed,
    unpaidDays: 0,
    paidDays,
    noAttendance: false,
    linkedMissing: false,
    blocked: null,
    daysInMonth,
    ...extra,
  });
  const member = match.member;
  if (board && member) {
    // Only this member's own rows — never a namesake's.
    const r = paidDaysFromRecords({
      records: board.records.filter((x) => x.userId === member.userId),
      month,
      today,
      holidays: board.holidays,
      isOffice: member.isOffice,
      weekOff: member.weekOff,
      startDate: member.startDate,
    });
    return { ...match, tracked: true, isOffice: member.isOffice, ...r, linkedMissing: false, blocked: null, daysInMonth };
  }
  if (board && emp.profileId) {
    const own = board.records.filter((x) => x.userId === emp.profileId && x.date.startsWith(month));
    if (own.length > 0) {
      const isOffice = isOfficeDepartment(emp.department);
      const r = paidDaysFromRecords({ records: own, month, today, holidays: board.holidays, isOffice, weekOff: SUNDAY_OFF });
      return { ...match, tracked: true, isOffice, ...r, linkedMissing: true, blocked: null, daysInMonth };
    }
    return untracked(0, {
      linkedMissing: true,
      blocked: `${emp.name}'s linked login wasn't found in attendance — check Team & Roles, or re-link the login.`,
    });
  }
  if (match.ambiguous) {
    return untracked(0, { blocked: `${emp.name} matches more than one person — link their login first.` });
  }
  return untracked(SALARY_BASIS_DAYS);
}

/**
 * Why a slip for this employee must not be generated right now (board-level
 * problem first, then the employee's own), or null when it's safe.
 */
export function slipRefusal(
  emp: Employee,
  board: AttendanceAdminBoard | undefined,
  month: string,
  today: string,
  employees: Employee[]
): { error: string } | { paidDays: number } {
  const boardProblem = attendanceBoardProblem(board, employees.length);
  if (boardProblem) return { error: boardProblem };
  const info = paidDaysFor(emp, board, month, today, employees);
  if (info.blocked) return { error: info.blocked };
  return { paidDays: info.paidDays };
}

/**
 * Current-month draft whose saved days equal what payroll computed on some
 * earlier day this month (and whose gross matches the current CTC) — the
 * only difference is the days elapsed since, not a real discrepancy.
 */
export function differsOnlyByElapsedDays(
  emp: Employee,
  board: AttendanceAdminBoard | undefined,
  month: string,
  today: string,
  employees: Employee[],
  slipPaidDays: number,
  slipGross: number
): boolean {
  if (month !== today.slice(0, 7)) return false;
  if (expectedGross(emp.monthlyCtc, slipPaidDays) !== slipGross) return false;
  for (const d of daysOfMonth(month)) {
    if (d >= today) break;
    const then = paidDaysFor(emp, board, month, d, employees);
    if (!then.blocked && Math.abs(then.paidDays - slipPaidDays) < 0.001) return true;
  }
  return false;
}

/** Gross for `paidDays` — exactly generateSlipAction's formula. */
export function expectedGross(monthlyCtc: number, paidDays: number): number {
  const days = Math.max(0, Math.min(paidDays, SALARY_BASIS_DAYS));
  return Math.round(((Number(monthlyCtc) || 0) * days) / SALARY_BASIS_DAYS);
}

/**
 * Internal consistency test: every calendar day of the month lands in
 * exactly one bucket. Worked + Paid Leave + Week Off + Holiday + Absent +
 * Half-Day + Not Joined + Upcoming (today/future working days, not yet
 * decided) must equal the days in the month.
 */
export function dayBucketSum(s: MonthlySummary): number {
  return s.worked + s.leave + s.weekOff + s.holiday + s.absent + s.halfDay + s.notJoined + s.upcoming;
}
