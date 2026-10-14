// Client-safe pure helpers + board types for employee attendance (no mock
// imports, no server-only code) — same role as src/lib/payroll/compute.ts.

import type { EmployeeAttendance, Project, Role } from "@/lib/types";

export interface MyAttendanceData {
  /** Today's record (checked in, maybe not yet out) — null if none. */
  today: EmployeeAttendance | null;
  /** Unclosed shift from a previous date that was never checked out — null if none. */
  unclosedPreviousShift?: EmployeeAttendance | null;
  /** All of the caller's records in `month`. */
  records: EmployeeAttendance[];
  /** Projects the caller is actually rostered to (via project_members). */
  assignedProjects: Project[];
  /**
   * True when the caller has a real project_members roster entry — the
   * site (project-based, selfie) flow. False means the office (one-tap,
   * no project) flow applies instead. Determined purely from assignment,
   * not role.
   */
  hasExplicitProjectAssignment: boolean;
  /** Org's shared office location for the office punch flow (all null = fence disabled). */
  officeGeofence: { lat: number | null; lng: number | null; radiusM: number | null };
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
}

export interface AttendanceAdminBoard {
  records: EmployeeAttendance[];
  members: AttendanceMember[];
  holidays: OrgHoliday[];
}

/** Single org for now; make per-org when a second timezone shows up. */
export const ORG_TIMEZONE = "Asia/Kolkata";
/** India has no DST, so this fixed offset is always correct for ORG_TIMEZONE. */
export const ORG_UTC_OFFSET = "+05:30";

/** Standard workday shift: starts 9:30 AM (used only as a UI default now — see note on LATE_ARRIVAL_CUTOFF), ends 6:00 PM (8h 30m / 510 minutes); minutes beyond this count as overtime. */
export const SHIFT_START_TIME = "09:30";
export const SHIFT_END_TIME = "18:00";
export const STANDARD_WORKDAY_MINUTES = 8 * 60 + 30; // 510 minutes (9:30 to 18:00)

/**
 * Late-arrival policy: check-in by 10:30 AM (site or office) is simply on
 * time, full day, no flag at all. A check-in after 10:30 AM is tagged "Late"
 * for visibility/record-keeping only — no matter how many times it happens
 * in a month, it never automatically reduces pay. (A super_admin can still
 * deliberately mark a day Half-Day/Absent by hand via Correct Attendance —
 * that's a manual HR decision, not this automatic rule.)
 */
export const LATE_ARRIVAL_CUTOFF = "10:30";

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

/** Check if check-in time is strictly after the 10:30 AM cut-off. */
export function isAfterLateGrace(iso: string): boolean {
  const t = timeInOrgTimezone(iso);
  return Boolean(t && t > LATE_ARRIVAL_CUTOFF);
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
 * Status of one calendar day given the user's records. Sundays are always
 * holidays; `isExtraHoliday` additionally marks admin-declared holidays
 * (already filtered to whether they apply to this employee — see
 * isHolidayFor). A past working day without a record is absent; today/future
 * without a record is not counted either way.
 */
export function dayStatus(
  date: string,
  hasRecord: boolean,
  today: string = orgToday(),
  isExtraHoliday: boolean = false
): DayStatus {
  if (hasRecord) return "present";
  if (new Date(`${date}T00:00:00`).getDay() === 0 || isExtraHoliday) return "holiday";
  return date < today ? "absent" : "future";
}

export type ShiftCreditType =
  | "on_time"           // Checked in <= 10:30 AM -> 1.0 day credit, no flag
  | "late_grace"        // Checked in > 10:30 AM -> 1.0 day credit, always — just flagged "Late"
  | "manual_present"    // Admin marked without check_in_at -> 1.0 day credit
  | "leave"             // Admin explicitly marked Leave -> 1.0 day credit (paid)
  | "explicit_half_day" // Admin explicitly marked Half-Day -> 0.5 day credit
  | "explicit_absent";  // Admin explicitly marked Absent -> 0 day credit

export interface EvaluatedAttendanceRecord {
  record: EmployeeAttendance;
  timeStr: string;        // "09:45"
  isLate: boolean;        // true for late_grace (checked in after 10:30 AM) — never costs pay on its own
  lateIndex: number;      // 1-based index among late arrivals of the month (0 if on-time)
  creditType: ShiftCreditType;
  dayCredit: number;      // 1.0 for full day, 0.5 for half day
  badgeLabel: string;     // "Present", "Late (3)"
  glyph: string;          // "P", "L", "HD"
  reason?: string;
}

export interface MonthlyAttendanceEvaluation {
  evaluatedRecords: EvaluatedAttendanceRecord[];
  recordMap: Map<string, EvaluatedAttendanceRecord>; // date -> EvaluatedAttendanceRecord
  totalDaysAttended: number; // raw record count
  fullDays: number;          // count of 1.0 day credits
  halfDays: number;          // count of 0.5 day credits
  lateCount: number;         // total late arrivals (checked in after 10:30 AM) — informational only, never affects pay
  effectivePaidDays: number; // fullDays + 0.5 * halfDays
}

/**
 * Evaluates an employee's attendance records for a month in chronological order.
 * Check-in by 10:30 AM is simply on time (Full Day), no flag. A check-in after
 * 10:30 AM is tagged "Late" for visibility only — it never automatically
 * reduces pay, no matter how many times it happens in the month. Only an
 * explicit admin-declared Leave/Half-Day/Absent changes the day's credit.
 */
export function evaluateEmployeeMonthAttendance(
  records: EmployeeAttendance[],
  month: string
): MonthlyAttendanceEvaluation {
  const monthRecords = records
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.checkInAt.localeCompare(b.checkInAt));

  let lateCount = 0;
  let fullDays = 0;
  let halfDays = 0;
  const evaluatedRecords: EvaluatedAttendanceRecord[] = [];
  const recordMap = new Map<string, EvaluatedAttendanceRecord>();

  for (const r of monthRecords) {
    const timeStr = timeInOrgTimezone(r.checkInAt);
    let creditType: ShiftCreditType = "on_time";
    let isLate = false;
    let lateIndex = 0;
    let dayCredit = 1.0;
    let badgeLabel = "Present";
    let glyph = r.source === "admin" ? "P*" : "P";
    let reason = "";

    // Explicit admin-declared status wins outright — no punch-time logic
    // applies to a day that was never actually punched.
    if (r.status === "leave") {
      creditType = "leave";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Leave";
      glyph = "LV";
      reason = r.note ? `Marked Leave — ${r.note}` : "Marked Leave.";
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
    } else if (isAfterLateGrace(r.checkInAt)) {
      isLate = true;
      lateCount += 1;
      lateIndex = lateCount;
      creditType = "late_grace";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = `Late (${lateCount})`;
      glyph = "L";
      reason = `Checked in at ${formatTime(r.checkInAt)} (Late arrival #${lateIndex} this month — Full Day credited; late arrivals never reduce pay automatically).`;
    } else {
      creditType = "on_time";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Present";
    }

    const evaluated: EvaluatedAttendanceRecord = {
      record: r,
      timeStr,
      isLate,
      lateIndex,
      creditType,
      dayCredit,
      badgeLabel,
      glyph,
      reason,
    };

    evaluatedRecords.push(evaluated);
    recordMap.set(r.date, evaluated);
  }

  const effectivePaidDays = fullDays + halfDays * 0.5;

  return {
    evaluatedRecords,
    recordMap,
    totalDaysAttended: monthRecords.length,
    fullDays,
    halfDays,
    lateCount,
    effectivePaidDays,
  };
}

export interface MonthlySummary {
  present: number;           // Full days (1.0 credits) — includes on-time, late (always full day), leave, manual
  halfDay: number;           // Half days (0.5 credits) — explicit admin-marked Half-Day only
  lateCount: number;         // Total late arrivals (after 10:30 AM) — informational only, never affects pay
  effectivePaidDays: number; // present + 0.5 * halfDay
  leave: number;             // Explicit Leave days (also counted in `present`'s paid-day weight)
  absent: number;            // No-record days + explicit Absent days
  holiday: number;
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
  isOffice: boolean = false
): MonthlySummary {
  const evalResult = evaluateEmployeeMonthAttendance(records, month);
  // Days with an explicit-absent row already have a record, so dayStatus()
  // (which only knows "does a row exist") would wrongly call them present —
  // count them separately and add them in.
  const explicitAbsentDates = new Set(
    evalResult.evaluatedRecords.filter((e) => e.creditType === "explicit_absent").map((e) => e.record.date)
  );
  const leave = evalResult.evaluatedRecords.filter((e) => e.creditType === "leave").length;
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  let absent = 0;
  let holiday = 0;

  for (const date of daysOfMonth(month)) {
    if (explicitAbsentDates.has(date)) {
      absent += 1;
      continue;
    }
    const status = dayStatus(date, recorded.has(date), today, isHolidayFor(date, holidays, isOffice));
    if (status === "absent") absent += 1;
    else if (status === "holiday") holiday += 1;
  }

  return {
    present: evalResult.fullDays,
    halfDay: evalResult.halfDays,
    lateCount: evalResult.lateCount,
    effectivePaidDays: evalResult.effectivePaidDays,
    leave,
    absent,
    holiday,
  };
}
