// Client-safe pure helpers + board types for employee attendance (no mock
// imports, no server-only code) — same role as src/lib/payroll/compute.ts.

import type { EmployeeAttendance, Project, Role } from "@/lib/types";

export interface MyAttendanceData {
  /** Today's record (checked in, maybe not yet out) — null if none. */
  today: EmployeeAttendance | null;
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

/** Standard workday; minutes beyond this count as overtime. */
export const STANDARD_WORKDAY_MINUTES = 8 * 60;

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

export interface MonthlySummary {
  present: number;
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
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  const out: MonthlySummary = { present: 0, absent: 0, holiday: 0 };
  for (const date of daysOfMonth(month)) {
    const status = dayStatus(date, recorded.has(date), today);
    if (status !== "future") out[status] += 1;
  }
  return out;
}
