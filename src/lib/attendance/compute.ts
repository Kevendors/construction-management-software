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
  /** Projects the caller may check in to (all org projects for super_admin). */
  assignedProjects: Project[];
  employeeId: string;
  userName: string;
  month: string; // "YYYY-MM"
}

export interface AttendanceMember {
  userId: string;
  name: string;
  employeeId: string;
  role: Role;
}

export interface AttendanceAdminBoard {
  records: EmployeeAttendance[];
  members: AttendanceMember[];
}

/** Single org for now; make per-org when a second timezone shows up. */
export const ORG_TIMEZONE = "Asia/Kolkata";
/** India has no DST, so this fixed offset is always correct for ORG_TIMEZONE. */
export const ORG_UTC_OFFSET = "+05:30";

/** Standard workday shift: 9:30 AM to 6:00 PM (8h 30m / 510 minutes); minutes beyond this count as overtime. */
export const SHIFT_START_TIME = "09:30";
export const SHIFT_END_TIME = "18:00";
export const STANDARD_WORKDAY_MINUTES = 8 * 60 + 30; // 510 minutes (9:30 to 18:00)

/** Late arrivals policy: Up to 3 late arrivals allowed until 10:15 AM per month; 4th+ or past 10:15 AM counts as half day. */
export const LATE_ARRIVAL_CUTOFF = "10:15";
export const ALLOWED_LATE_ARRIVALS = 3;

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

/** Check if check-in time is late (> 09:30 AM). */
export function isLateArrival(iso: string): boolean {
  const t = timeInOrgTimezone(iso);
  return Boolean(t && t > SHIFT_START_TIME);
}

/** Check if check-in time is within the allowed late grace buffer (09:31..10:15 AM). */
export function isWithinLateGrace(iso: string): boolean {
  const t = timeInOrgTimezone(iso);
  return Boolean(t && t > SHIFT_START_TIME && t <= LATE_ARRIVAL_CUTOFF);
}

/** Check if check-in time is strictly after the 10:15 AM grace cut-off. */
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

/**
 * Status of one calendar day given the user's records. Sundays are holidays
 * (no org holiday table yet); a past working day without a record is absent;
 * today/future without a record is not counted either way.
 */
export function dayStatus(
  date: string,
  hasRecord: boolean,
  today: string = orgToday()
): DayStatus {
  if (hasRecord) return "present";
  if (new Date(`${date}T00:00:00`).getDay() === 0) return "holiday";
  return date < today ? "absent" : "future";
}

export type ShiftCreditType =
  | "on_time"              // Checked in <= 09:30 AM -> 1.0 day credit
  | "late_grace"           // Checked in 09:31..10:15 AM (within 3 allowed per month) -> 1.0 day credit
  | "late_half_day"        // Checked in 09:31..10:15 AM (4th or later late arrival) -> 0.5 day credit
  | "late_cutoff_half_day" // Checked in > 10:15 AM (after grace cutoff) -> 0.5 day credit
  | "manual_present";      // Admin marked without check_in_at -> 1.0 day credit

export interface EvaluatedAttendanceRecord {
  record: EmployeeAttendance;
  timeStr: string;        // "09:45"
  isLate: boolean;
  lateIndex: number;      // 1-based index among late arrivals of the month (0 if on-time)
  creditType: ShiftCreditType;
  dayCredit: number;      // 1.0 for full day, 0.5 for half day
  badgeLabel: string;     // "Present", "Late (1/3)", "Half Day (Late)", "Half Day (>10:15)"
  glyph: string;          // "P", "L", "HD"
  reason?: string;
}

export interface MonthlyAttendanceEvaluation {
  evaluatedRecords: EvaluatedAttendanceRecord[];
  recordMap: Map<string, EvaluatedAttendanceRecord>; // date -> EvaluatedAttendanceRecord
  totalDaysAttended: number; // raw record count
  fullDays: number;          // count of 1.0 day credits
  halfDays: number;          // count of 0.5 day credits
  lateCount: number;         // total times late (>09:30)
  lateGraceUsed: number;     // min(lateCount, ALLOWED_LATE_ARRIVALS)
  effectivePaidDays: number; // fullDays + 0.5 * halfDays
}

/**
 * Evaluates an employee's attendance records for a month in chronological order,
 * applying the 3 allowed late arrivals rule (up to 10:15 AM). 4th late arrival onward
 * or any arrival past 10:15 AM is converted to a Half Day (0.5 paid day).
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

    if (!r.checkInAt) {
      creditType = "manual_present";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Present (Manual)";
    } else if (isAfterLateGrace(r.checkInAt)) {
      isLate = true;
      lateCount += 1;
      lateIndex = lateCount;
      creditType = "late_cutoff_half_day";
      dayCredit = 0.5;
      halfDays += 1;
      badgeLabel = "Half Day (>10:15 AM)";
      glyph = "HD";
      reason = `Checked in at ${formatTime(r.checkInAt)} (after 10:15 AM cutoff). Counted as Half Day.`;
    } else if (isWithinLateGrace(r.checkInAt)) {
      isLate = true;
      lateCount += 1;
      lateIndex = lateCount;
      if (lateCount <= ALLOWED_LATE_ARRIVALS) {
        creditType = "late_grace";
        dayCredit = 1.0;
        fullDays += 1;
        badgeLabel = `Late (${lateCount}/${ALLOWED_LATE_ARRIVALS})`;
        glyph = "L";
        reason = `Checked in at ${formatTime(r.checkInAt)} (Late arrival #${lateIndex} of ${ALLOWED_LATE_ARRIVALS} allowed — Full Day credited).`;
      } else {
        creditType = "late_half_day";
        dayCredit = 0.5;
        halfDays += 1;
        badgeLabel = `Half Day (Late #${lateIndex})`;
        glyph = "HD";
        reason = `Checked in at ${formatTime(r.checkInAt)} (Late arrival #${lateIndex} exceeds monthly allowance of ${ALLOWED_LATE_ARRIVALS} — counted as Half Day).`;
      }
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
  const lateGraceUsed = Math.min(lateCount, ALLOWED_LATE_ARRIVALS);

  return {
    evaluatedRecords,
    recordMap,
    totalDaysAttended: monthRecords.length,
    fullDays,
    halfDays,
    lateCount,
    lateGraceUsed,
    effectivePaidDays,
  };
}

export interface MonthlySummary {
  present: number;           // Full days (1.0 credits)
  halfDay: number;           // Half days (0.5 credits)
  lateCount: number;         // Total late arrivals
  lateGraceUsed: number;     // Late arrivals within quota (<= 3)
  effectivePaidDays: number; // present + 0.5 * halfDay
  absent: number;
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
  today: string = orgToday()
): MonthlySummary {
  const evalResult = evaluateEmployeeMonthAttendance(records, month);
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  let absent = 0;
  let holiday = 0;

  for (const date of daysOfMonth(month)) {
    const status = dayStatus(date, recorded.has(date), today);
    if (status === "absent") absent += 1;
    else if (status === "holiday") holiday += 1;
  }

  return {
    present: evalResult.fullDays,
    halfDay: evalResult.halfDays,
    lateCount: evalResult.lateCount,
    lateGraceUsed: evalResult.lateGraceUsed,
    effectivePaidDays: evalResult.effectivePaidDays,
    absent,
    holiday,
  };
}
