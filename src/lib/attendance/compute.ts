// Client-safe pure helpers + board types for employee attendance (no mock
// imports, no server-only code) — same role as src/lib/payroll/compute.ts.

import type { EmployeeAttendance, Project, Role, SpotCheck } from "@/lib/types";

export interface MyAttendanceData {
  /** Today's record (checked in, maybe not yet out) — null if none. */
  today: EmployeeAttendance | null;
  /** Unclosed shift from a previous date that was never checked out — null if none. */
  unclosedPreviousShift?: EmployeeAttendance | null;
  /** A fired, still-open random location check (0045) — null if none. */
  pendingSpotCheck: SpotCheck | null;
  /** All of the caller's records in `month`. */
  records: EmployeeAttendance[];
  /**
   * Projects offered in the site check-in picker: the caller's roster
   * (project_members), or every open org project for Site staff who aren't
   * rostered anywhere yet.
   */
  assignedProjects: Project[];
  /**
   * True for Site staff — the project-based, selfie check-in flow. False
   * means the office (one-tap, no project) flow. Follows the Office/Site
   * setting on the Team page (`isOffice`), not project assignment.
   */
  usesSiteFlow: boolean;
  /**
   * Whether the caller counts as Office (vs Site) for policy purposes --
   * the 1-paid-leave-per-month rule, office-only-holiday exclusion, and the
   * Office/Site badge. Explicitly set per member on the Team page.
   */
  isOffice: boolean;
  /** Org's shared office location for the office punch flow (all null = fence disabled). */
  officeGeofence: { lat: number | null; lng: number | null; radiusM: number | null };
  /** Declared company holidays — excluded from the office 1-paid-Leave-per-month count. */
  holidays: OrgHoliday[];
  /** The caller's weekly off rule (0047) — SUNDAY_OFF until the migration is applied. */
  weekOff: WeekOffRule;
  employeeId: string;
  userName: string;
  month: string; // "YYYY-MM"
}

export interface AttendanceMember {
  userId: string;
  name: string;
  employeeId: string;
  role: Role;
  /** True when this member has no project_members roster entry — the office (not site) flow applies to them. */
  isOffice: boolean;
  /** Default weekly off day + recorded swaps (0047) — SUNDAY_OFF until the migration is applied. */
  weekOff: WeekOffRule;
}

export interface AttendanceAdminBoard {
  records: EmployeeAttendance[];
  members: AttendanceMember[];
  holidays: OrgHoliday[];
  /** Every recorded weekly-off swap in the org (0047), for listing/deleting — already folded into each member's `weekOff`. */
  weekOffSwaps: WeekOffSwap[];
}

/** One recorded weekly-off swap row (attendance_week_off_swaps, 0047). */
export interface WeekOffSwap {
  id: string;
  userId: string;
  workedDate: string;
  offDate: string;
  note: string;
}

/** Single org for now; make per-org when a second timezone shows up. */
export const ORG_TIMEZONE = "Asia/Kolkata";
/** India has no DST, so this fixed offset is always correct for ORG_TIMEZONE. */
export const ORG_UTC_OFFSET = "+05:30";

/** Standard workday shift: starts 9:30 AM (used only as a UI default), ends 6:00 PM (8h 30m / 510 minutes); minutes beyond this count as overtime. */
export const SHIFT_START_TIME = "09:30";
export const SHIFT_END_TIME = "18:00";
export const STANDARD_WORKDAY_MINUTES = 8 * 60 + 30; // 510 minutes (9:30 to 18:00)

/**
 * Late-arrival policy (applies to every employee, Office and Site alike):
 * checking in after this time counts as a "late arrival". The first
 * LATE_ARRIVALS_ALLOWED_PER_MONTH in a calendar month are free passes (still
 * Present, Full Day); the next one onward auto-converts that day to Half-Day.
 */
export const LATE_ARRIVAL_CUTOFF_TIME = "10:30";
export const LATE_ARRIVALS_ALLOWED_PER_MONTH = 3;

/** True when a check-in ISO timestamp falls after LATE_ARRIVAL_CUTOFF_TIME, org-local. */
export function isLateCheckIn(checkInAtIso: string): boolean {
  if (!checkInAtIso) return false;
  return timeInOrgTimezone(checkInAtIso) > LATE_ARRIVAL_CUTOFF_TIME;
}

/** "HH:mm" in ORG_TIMEZONE (24-hour clock, zero-padded). */
export function timeInOrgTimezone(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: ORG_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    return `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  } catch {
    return "";
  }
}

/**
 * Today's date ("YYYY-MM-DD") in the org's timezone. Never derive the
 * attendance day from toISOString() — UTC flips the date before 5:30 AM IST.
 */
export function orgToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE }).format(new Date());
}

/** Current month ("YYYY-MM") in the org's timezone. */
export function orgThisMonth(): string {
  return orgToday().slice(0, 7);
}

/** Great-circle distance in meters between two lat/lng points. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/** Whole minutes between two ISO timestamps (never negative). */
export function minutesBetween(fromIso: string, toIso: string): number {
  const ms = +new Date(toIso) - +new Date(fromIso);
  return Math.max(0, Math.floor(ms / 60000));
}

export function overtimeOf(totalMinutes: number): number {
  return Math.max(0, totalMinutes - STANDARD_WORKDAY_MINUTES);
}

/** "7h 45m" (or "45m" under an hour). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** "9:04 AM" in the org timezone (empty input → "—"). */
export function formatTime(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export type DayStatus = "present" | "absent" | "holiday" | "future";

/** A company holiday declared by an admin — see org_holidays (migration 0037). */
export interface OrgHoliday {
  date: string; // "YYYY-MM-DD"
  label: string;
  appliesTo: "all" | "office";
}

/** True when `date` is a declared holiday that excuses this particular employee. */
export function isHolidayFor(date: string, holidays: OrgHoliday[], isOffice: boolean): boolean {
  return holidays.some((h) => h.date === date && (h.appliesTo === "all" || (h.appliesTo === "office" && isOffice)));
}

/**
 * An employee's weekly off: a default day of the week (Team page, Sunday
 * unless changed) plus Admin/HR-recorded swaps — "works `workedDate` (a
 * default off day), takes `offDate` off instead", same week (±6 days).
 * Pay treats a weekly off exactly like the old hard-coded Sunday.
 */
export interface WeekOffRule {
  defaultDow: number; // 0 = Sunday … 6 = Saturday (JS getDay()) — the current default
  /**
   * Changes to the default (attendance_weekly_off_history), sorted by `from`
   * ("YYYY-MM-DD"). A date uses the latest entry with from <= date (Sunday if
   * none), so changing the default never rewrites history. Absent/empty =
   * `defaultDow` applies to every date (never changed).
   */
  history?: { dow: number; from: string }[];
  swaps: { workedDate: string; offDate: string }[];
}

/** The pre-0047 behaviour: everyone is off on Sunday, no swaps. */
export const SUNDAY_OFF: WeekOffRule = { defaultDow: 0, swaps: [] };

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date — UTC, so the host timezone never shifts it. */
function dowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The default weekly-off weekday in force on `date` (before any swaps). */
export function defaultDowOn(rule: WeekOffRule, date: string): number {
  if (!rule.history?.length) return rule.defaultDow;
  let dow = 0; // no entry at or before `date` → the pre-0047 Sunday
  for (const h of rule.history) {
    if (h.from <= date) dow = h.dow;
    else break; // sorted by `from`
  }
  return dow;
}

/** True when `date` is a weekly off under `rule` (a swap's off day, or the default day not swapped away). */
export function isWeeklyOff(date: string, rule: WeekOffRule = SUNDAY_OFF): boolean {
  if (rule.swaps.some((s) => s.offDate === date)) return true;
  return dowOf(date) === defaultDowOn(rule, date) && !rule.swaps.some((s) => s.workedDate === date);
}

/** Sorts history rows (any order) into WeekOffRule["history"]. */
export function toWeekOffHistory(rows: { dow: number; effective_from: string }[]): { dow: number; from: string }[] {
  return rows
    .map((r) => ({ dow: r.dow, from: r.effective_from }))
    .sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * Who sees the weekly-off UI (Team select, swap dialog). Data and
 * calculations apply to everyone; remove an entry here to hide the UI for
 * that group.
 */
export const WEEK_OFF_UI_FOR: ("site" | "office")[] = ["site", "office"];

export function weekOffUiEnabled(isOffice: boolean): boolean {
  return WEEK_OFF_UI_FOR.includes(isOffice ? "office" : "site");
}

/** Whole days from `a` to `b` ("YYYY-MM-DD"), via UTC so DST never skews it. */
function daysBetween(a: string, b: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a proposed swap (work `workedDate`, take `offDate` off) against the
 * employee's current rule. Returns an error message, or null when valid.
 * Run on the client for instant feedback and again on the server with fresh
 * data before inserting.
 */
export function validateWeekOffSwap(
  rule: WeekOffRule,
  workedDate: string,
  offDate: string,
  holidays: OrgHoliday[],
  isOffice: boolean
): string | null {
  if (!ISO_DATE.test(workedDate) || !ISO_DATE.test(offDate)) return "Enter valid dates.";
  if (workedDate === offDate) return "The replacement off day must be a different day.";
  if (Math.abs(daysBetween(workedDate, offDate)) > 6) {
    return "The replacement off day must be within 6 days of the worked day (same week).";
  }
  const used = (d: string) => rule.swaps.some((s) => s.workedDate === d || s.offDate === d);
  if (used(workedDate)) return "The worked day is already part of another swap.";
  if (used(offDate)) return "The replacement off day is already part of another swap.";
  if (!isWeeklyOff(workedDate, rule)) return "The worked day isn't one of this employee's weekly off days.";
  if (isHolidayFor(workedDate, holidays, isOffice)) return "The worked day is a declared holiday — record it as worked on the holiday instead.";
  if (isWeeklyOff(offDate, rule)) return "The replacement off day is already a weekly off.";
  if (isHolidayFor(offDate, holidays, isOffice)) return "The replacement off day is already a declared holiday.";
  return null;
}

/**
 * Status of one calendar day given the user's records. Weekly offs (see
 * isWeeklyOff — Sunday unless the employee's rule says otherwise) are
 * holidays; `isExtraHoliday` additionally marks admin-declared holidays
 * (already filtered to whether they apply to this employee — see
 * isHolidayFor). A past working day without a record is absent; today/future
 * without a record is not counted either way.
 */
export function dayStatus(
  date: string,
  hasRecord: boolean,
  today: string = orgToday(),
  isExtraHoliday: boolean = false,
  rule: WeekOffRule = SUNDAY_OFF
): DayStatus {
  if (hasRecord) return "present";
  if (isWeeklyOff(date, rule) || isExtraHoliday) return "holiday";
  return date < today ? "absent" : "future";
}

export type ShiftCreditType =
  | "on_time"           // Any real check-in -> 1.0 day credit, no flag regardless of time
  | "manual_present"    // Admin marked without check_in_at -> 1.0 day credit
  | "leave"             // Admin explicitly marked Leave, within the paid allowance -> 1.0 day credit (paid)
  | "leave_unpaid"      // Office staff only: 2nd+ Leave this month -> 0 day credit, and retroactively so does the 1st
  | "explicit_half_day" // Admin explicitly marked Half-Day -> 0.5 day credit
  | "explicit_absent"   // Admin explicitly marked Absent -> 0 day credit
  | "declared_holiday"; // Any non-present status landing on a declared company holiday -> shown as Holiday, not Leave/Half-Day/Absent; 1.0 day credit (paid), same as a day actually worked

export interface EvaluatedAttendanceRecord {
  record: EmployeeAttendance;
  timeStr: string;        // "09:45"
  creditType: ShiftCreditType;
  dayCredit: number;      // 1.0 for full day, 0.5 for half day
  badgeLabel: string;     // "Present"
  glyph: string;          // "P", "HD"
  reason?: string;
}

export interface MonthlyAttendanceEvaluation {
  evaluatedRecords: EvaluatedAttendanceRecord[];
  recordMap: Map<string, EvaluatedAttendanceRecord>; // date -> EvaluatedAttendanceRecord
  totalDaysAttended: number; // raw record count
  fullDays: number;          // count of 1.0 day credits
  halfDays: number;          // count of 0.5 day credits
  unpaidLeave: number;       // count of Leave days converted to unpaid (office staff, 2nd+ Leave this month)
  effectivePaidDays: number; // fullDays + 0.5 * halfDays
}

const DECLARED_STATUS_LABEL: Record<string, string> = { leave: "Leave", half_day: "Half Day", absent: "Absent" };
function badgeLabelFor(status: string): string {
  return DECLARED_STATUS_LABEL[status] ?? status;
}

/**
 * Evaluates an employee's attendance records for a month in chronological order.
 * A real check-in is Present (Full Day) unless it was the 4th+ late arrival
 * that month (see evaluateLateArrival in attendance/actions.ts), in which case
 * it was already stored as status "half_day" at check-in time and is handled
 * by the half_day branch below like any other Half-Day. Beyond that, only an
 * explicit admin-declared Leave/Half-Day/Absent changes the day's credit.
 *
 * Office staff get 1 paid Leave per month — `isOffice` only matters for this.
 * Taking a 2nd Leave in the same month makes BOTH (every Leave that month,
 * not just the extra one) unpaid, so the whole month is re-evaluated as a
 * unit rather than deciding each Leave record in isolation as it's reached.
 *
 * A declarative mark (Leave/Half-Day/Absent) dated on a declared company
 * holiday is shown and counted as a Holiday instead — not as Leave (paid or
 * unpaid), Half-Day or Absent, and never counts toward the paid-Leave
 * allowance either. A real check-in on a holiday is unaffected either way.
 *
 * Declared company holidays are paid (1.0 day credit) whether or not the
 * employee actually checked in that day — same whether there's a row for
 * that date or not, up through today (a holiday later this month isn't
 * credited before it happens).
 */
export function evaluateEmployeeMonthAttendance(
  records: EmployeeAttendance[],
  month: string,
  isOffice: boolean = false,
  holidays: OrgHoliday[] = []
): MonthlyAttendanceEvaluation {
  const monthRecords = records
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.checkInAt.localeCompare(b.checkInAt));

  const isDeclaredHolidayRecord = (r: EmployeeAttendance) =>
    r.status !== "present" && isHolidayFor(r.date, holidays, isOffice);
  const totalLeaveCount = monthRecords.filter((r) => r.status === "leave" && !isDeclaredHolidayRecord(r)).length;
  const leavesAreUnpaid = isOffice && totalLeaveCount > 1;

  let fullDays = 0;
  let halfDays = 0;
  let unpaidLeave = 0;
  const evaluatedRecords: EvaluatedAttendanceRecord[] = [];
  const recordMap = new Map<string, EvaluatedAttendanceRecord>();

  for (const r of monthRecords) {
    const timeStr = timeInOrgTimezone(r.checkInAt);
    let creditType: ShiftCreditType = "on_time";
    let dayCredit = 1.0;
    let badgeLabel = "Present";
    let glyph = r.source === "admin" ? "P*" : "P";
    let reason = "";

    // A declared holiday overrides any non-present status outright — it's
    // never Leave/Half-Day/Absent, just a Holiday, same as an ordinary
    // unrecorded one. Checked first, before the status-specific branches.
    if (isDeclaredHolidayRecord(r)) {
      creditType = "declared_holiday";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Holiday";
      glyph = "";
      reason = `Falls on a declared company holiday${r.note ? ` — ${r.note}` : ""} — recorded as Holiday (paid), not ${badgeLabelFor(r.status)}.`;
    } else if (r.status === "leave") {
      if (leavesAreUnpaid) {
        creditType = "leave_unpaid";
        dayCredit = 0;
        unpaidLeave += 1;
        badgeLabel = "Leave (Unpaid)";
        glyph = "LU";
        reason = `Office staff get 1 paid Leave per month — this is Leave #${
          monthRecords.filter((x) => x.status === "leave" && !isDeclaredHolidayRecord(x) && x.date <= r.date).length
        } this month, so it (and the earlier one) is unpaid.${r.note ? ` ${r.note}` : ""}`;
      } else {
        creditType = "leave";
        dayCredit = 1.0;
        fullDays += 1;
        badgeLabel = "Leave";
        glyph = "LV";
        reason = r.note ? `Marked Leave — ${r.note}` : "Marked Leave.";
      }
    } else if (r.status === "half_day") {
      creditType = "explicit_half_day";
      dayCredit = 0.5;
      halfDays += 1;
      badgeLabel = "Half Day";
      glyph = "HD";
      reason = r.note ? `Marked Half Day — ${r.note}` : "Marked Half Day.";
    } else if (r.status === "absent") {
      creditType = "explicit_absent";
      dayCredit = 0;
      badgeLabel = "Absent";
      glyph = "A";
      reason = r.note ? `Marked Absent — ${r.note}` : "Marked Absent.";
    } else if (!r.checkInAt) {
      creditType = "manual_present";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Present (Manual)";
    } else {
      creditType = "on_time";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Present";
    }

    const evaluated: EvaluatedAttendanceRecord = {
      record: r,
      timeStr,
      creditType,
      dayCredit,
      badgeLabel,
      glyph,
      reason,
    };

    evaluatedRecords.push(evaluated);
    recordMap.set(r.date, evaluated);
  }

  // Declared holidays are paid whether or not the employee actually checked
  // in. The branch above already credits one that happens to have a row
  // (e.g. an admin-declared Leave/Absent landing on it); this covers the far
  // more common case of no row at all — nobody works a holiday, so nothing
  // in `monthRecords` represents that day. Only counts up to today, so a
  // holiday later this month isn't paid before it's even happened.
  const today = orgToday();
  const recordedDates = new Set(monthRecords.map((r) => r.date));
  for (const date of daysOfMonth(month)) {
    if (date > today) break;
    if (recordedDates.has(date)) continue;
    if (isHolidayFor(date, holidays, isOffice)) fullDays += 1;
  }

  const effectivePaidDays = fullDays + halfDays * 0.5;

  return {
    evaluatedRecords,
    recordMap,
    totalDaysAttended: monthRecords.length,
    fullDays,
    halfDays,
    unpaidLeave,
    effectivePaidDays,
  };
}

export interface MonthlySummary {
  present: number;           // Full days (1.0 credits) — includes on-time, leave (within allowance), manual
  halfDay: number;           // Half days (0.5 credits) — explicit admin-marked Half-Day only
  effectivePaidDays: number; // present + 0.5 * halfDay
  leave: number;             // Paid Leave days (also counted in `present`'s paid-day weight)
  unpaidLeave: number;       // Office staff only: Leave days converted to unpaid (2nd+ in the month)
  absent: number;            // No-record days + explicit Absent days
  holiday: number;           // Declared company holidays only
  weekOff: number;           // Weekly off days (default day or swapped-in off day) not worked
}

/** List every day of a "YYYY-MM" month as "YYYY-MM-DD" strings. */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(y, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

export function monthlySummary(
  records: EmployeeAttendance[],
  month: string,
  today: string = orgToday(),
  holidays: OrgHoliday[] = [],
  isOffice: boolean = false,
  rule: WeekOffRule = SUNDAY_OFF
): MonthlySummary {
  const evalResult = evaluateEmployeeMonthAttendance(records, month, isOffice, holidays);
  // Days with an explicit-absent or declared-holiday row already have a
  // record, so dayStatus() (which only knows "does a row exist") would
  // wrongly call them present — count them separately and add them in.
  const explicitAbsentDates = new Set(
    evalResult.evaluatedRecords.filter((e) => e.creditType === "explicit_absent").map((e) => e.record.date)
  );
  const declaredHolidayDates = new Set(
    evalResult.evaluatedRecords.filter((e) => e.creditType === "declared_holiday").map((e) => e.record.date)
  );
  const leave = evalResult.evaluatedRecords.filter((e) => e.creditType === "leave").length;
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  let absent = 0;
  let holiday = 0;
  let weekOff = 0;

  for (const date of daysOfMonth(month)) {
    if (explicitAbsentDates.has(date)) {
      absent += 1;
      continue;
    }
    if (declaredHolidayDates.has(date)) {
      holiday += 1;
      continue;
    }
    const isDeclared = isHolidayFor(date, holidays, isOffice);
    const status = dayStatus(date, recorded.has(date), today, isDeclared, rule);
    if (status === "absent") absent += 1;
    // A declared holiday that also lands on a weekly off counts once, as Holiday.
    else if (status === "holiday") {
      if (isDeclared) holiday += 1;
      else weekOff += 1;
    }
  }

  return {
    present: evalResult.fullDays,
    halfDay: evalResult.halfDays,
    effectivePaidDays: evalResult.effectivePaidDays,
    leave,
    unpaidLeave: evalResult.unpaidLeave,
    absent,
    holiday,
    weekOff,
  };
}
