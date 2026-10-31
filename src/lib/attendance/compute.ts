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
  /**
   * Switch Site (0050): today's site visits, oldest first. Empty when there
   * are none or the migration isn't applied yet.
   */
  todayVisits: { id: string; projectId: string | null; projectName: string; arrivedAt: string }[];
  /** Name of today's check-in project (the first site), "" when none. */
  todayProjectName: string;
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
  /**
   * 0050 addendum: a Site member allowed to use "Office" as a site (Team page
   * tick) — offered first in the check-in and Switch Site pickers. False for
   * Office staff and until the migration is applied.
   */
  canWorkFromOffice: boolean;
  /**
   * 0051: an Office member allowed to punch away from the office with a reason
   * (Team page "Client visits allowed" tick). False for Site staff and until
   * the migration is applied.
   */
  clientVisitsAllowed: boolean;
  /** Org's shared office location for the office punch flow (all null = fence disabled). */
  officeGeofence: { lat: number | null; lng: number | null; radiusM: number | null };
  /** Declared company holidays — excluded from the office 1-paid-Leave-per-month count. */
  holidays: OrgHoliday[];
  /** The caller's weekly off rule (0047) — SUNDAY_OFF until the migration is applied. */
  weekOff: WeekOffRule;
  /** Membership created_at as an org-local date — office auto-leave never counts days before it. Absent = no floor. */
  startDate?: string;
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
  /** 0050 addendum: Site member allowed to use "Office" as a site. Absent = false. */
  canWorkFromOffice?: boolean;
  /** Default weekly off day + recorded swaps (0047) — SUNDAY_OFF until the migration is applied. */
  weekOff: WeekOffRule;
  /** Membership created_at as an org-local date — office auto-leave never counts days before it. Absent = no floor. */
  startDate?: string;
}

export interface AttendanceAdminBoard {
  records: EmployeeAttendance[];
  members: AttendanceMember[];
  holidays: OrgHoliday[];
  /** Every recorded weekly-off swap in the org (0047), for listing/deleting — already folded into each member's `weekOff`. */
  weekOffSwaps: WeekOffSwap[];
  /** True when part of the board (holidays / profiles) failed to load — pay must not be computed from it. */
  incomplete?: boolean;
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

/**
 * Early check-out rule (self check-out only, Office and Site alike): checking
 * out strictly before SHIFT_END_TIME org-local needs a reason and turns the
 * day into a Half-Day. False for an empty/unparseable timestamp.
 */
export function isEarlyCheckout(checkOutAtIso: string): boolean {
  const t = timeInOrgTimezone(checkOutAtIso);
  return t !== "" && t < SHIFT_END_TIME;
}

/** Preset reasons offered on the "Early check-out" step ("Other" = typed text). */
export const EARLY_CHECKOUT_REASONS = [
  "Personal work",
  "Medical",
  "Work completed / Site work done",
  "Client meeting",
];
export const MAX_EARLY_REASON = 200;

/**
 * A declarative row: an admin-declared Leave / Half-Day / Absent with no real
 * punch. A SELF half_day (4th+ late arrival, early check-out) is a real punch
 * — never declarative — so views keep its project, times, selfies and map.
 */
export function isDeclarativeRecord(r: Pick<EmployeeAttendance, "status" | "source">): boolean {
  return r.status !== "present" && r.source !== "self";
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

/** The org-local date ("YYYY-MM-DD") of an ISO timestamp, e.g. a row's created_at ("" when unparseable). */
export function orgDateOf(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: ORG_TIMEZONE }).format(d);
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

/** "not_joined": a no-record day before the member's start date — never Absent, Week Off or Holiday. */
export type DayStatus = "present" | "absent" | "holiday" | "future" | "not_joined";

/**
 * True when `date` is before the member joined (`startDate`, IST "YYYY-MM-DD").
 * Such a day isn't Absent, a weekly off or a holiday — the member wasn't
 * employed yet. No `startDate` = never.
 */
export function isBeforeJoining(date: string, startDate?: string): boolean {
  return Boolean(startDate) && date < startDate!;
}

/** Tooltip for a day before the member joined. */
export function beforeJoiningLabel(startDate: string): string {
  return `Before joining (${startDate})`;
}

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
 * How an employee's weekly offs are decided (0049):
 * - "fixed": one weekday every week (`dow`; Sunday unless changed).
 * - "alternate_sunday": every other Sunday — `anchor` is one off Sunday; a
 *   Sunday an even number of weeks from it (either direction) is off, the
 *   other Sundays are working days.
 * - "flexible": no fixed off days — the employee may skip as many days as
 *   the month has Sundays; the first that many missed days (no record) are
 *   weekly offs. Resolved per month, see weekOffDatesForMonth.
 */
export type WeekOffKind = "fixed" | "alternate_sunday" | "flexible";
export const WEEK_OFF_KINDS: WeekOffKind[] = ["fixed", "alternate_sunday", "flexible"];

/** Normalises a DB value (missing column / null / junk) to a kind — anything unknown is "fixed". */
export function toWeekOffKind(v: unknown): WeekOffKind {
  return WEEK_OFF_KINDS.includes(v as WeekOffKind) ? (v as WeekOffKind) : "fixed";
}

/** The weekly-off pattern in force on one date (kind + its weekday / anchor). */
export interface WeekOffPattern {
  kind: WeekOffKind;
  dow: number;
  anchor?: string;
}

/**
 * An employee's weekly off: a default day of the week (Team page, Sunday
 * unless changed) plus Admin/HR-recorded swaps — "works `workedDate` (a
 * default off day), takes `offDate` off instead", same week (±6 days).
 * Pay treats a weekly off exactly like the old hard-coded Sunday.
 */
export interface WeekOffRule {
  defaultDow: number; // 0 = Sunday … 6 = Saturday (JS getDay()) — the current default
  /** The current kind (0049) — absent = "fixed". */
  kind?: WeekOffKind;
  /** alternate_sunday: one off Sunday ("YYYY-MM-DD"). */
  anchor?: string;
  /**
   * Changes to the default (attendance_weekly_off_history), sorted by `from`
   * ("YYYY-MM-DD"). A date uses the latest entry with from <= date (fixed
   * Sunday if none), so changing the default never rewrites history.
   * Absent/empty = the top-level fields apply to every date (never changed).
   */
  history?: { dow: number; from: string; kind?: WeekOffKind; anchor?: string }[];
  swaps: { workedDate: string; offDate: string }[];
}

/** The pre-0047 behaviour: everyone is off on Sunday, no swaps. */
export const SUNDAY_OFF: WeekOffRule = { defaultDow: 0, swaps: [] };

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date — UTC, so the host timezone never shifts it. */
function dowOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** True when a "YYYY-MM-DD" date is a Sunday. */
export function isSunday(date: string): boolean {
  return ISO_DATE.test(date) && dowOf(date) === 0;
}

/** The weekly-off pattern in force on `date` (before any swaps). */
export function weekOffPatternOn(rule: WeekOffRule, date: string): WeekOffPattern {
  if (!rule.history?.length) return { kind: rule.kind ?? "fixed", dow: rule.defaultDow, anchor: rule.anchor };
  let pattern: WeekOffPattern = { kind: "fixed", dow: 0 }; // no entry at or before `date` → the pre-0047 Sunday
  for (const h of rule.history) {
    if (h.from <= date) pattern = { kind: h.kind ?? "fixed", dow: h.dow, anchor: h.anchor };
    else break; // sorted by `from`
  }
  return pattern;
}

/** The default weekly-off weekday in force on `date` (before any swaps). */
export function defaultDowOn(rule: WeekOffRule, date: string): number {
  return weekOffPatternOn(rule, date).dow;
}

/** Whether `date` is off under one pattern, ignoring swaps. Flexible is never off here (month-level, see weekOffDatesForMonth). */
function isOffUnderPattern(date: string, p: WeekOffPattern): boolean {
  if (p.kind === "flexible") return false;
  if (p.kind === "alternate_sunday") {
    if (dowOf(date) !== 0) return false;
    if (!p.anchor) return true; // no anchor recorded — every Sunday, the safe default
    const weeks = Math.floor(daysBetween(p.anchor, date) / 7);
    return ((weeks % 2) + 2) % 2 === 0;
  }
  return dowOf(date) === p.dow;
}

/**
 * True when `date` is a weekly off under `rule` (a swap's off day, or the
 * default day not swapped away). Always false on a "flexible" day — those
 * offs depend on the month's records; use weekOffDatesForMonth.
 */
export function isWeeklyOff(date: string, rule: WeekOffRule = SUNDAY_OFF): boolean {
  if (rule.swaps.some((s) => s.offDate === date)) return true;
  return isOffUnderPattern(date, weekOffPatternOn(rule, date)) && !rule.swaps.some((s) => s.workedDate === date);
}

/**
 * Every weekly-off date in `month` for one member. Fixed / alternate days
 * come from isWeeklyOff. On days where "flexible" is in force, the first N
 * missed days in date order are weekly offs, N = Sundays in the month; a
 * missed day is before `today`, has no record, isn't a declared holiday for
 * the member and is on/after `startDate` when given. Missed days beyond N
 * stay working days (Absent). Days with any row never use up the allowance.
 */
export function weekOffDatesForMonth(
  month: string,
  rule: WeekOffRule,
  records: EmployeeAttendance[],
  holidays: OrgHoliday[],
  isOffice: boolean,
  today: string = orgToday(),
  startDate?: string
): Set<string> {
  const days = daysOfMonth(month);
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  // Flexible allowance = Sundays in the month — only those on/after the
  // member's start date, so a mid-month joiner gets a pro-rated allowance
  // (joined 28 Oct → no Sundays left → no flexible offs that month).
  let allowance = days.filter((d) => dowOf(d) === 0 && (!startDate || d >= startDate)).length;
  const out = new Set<string>();
  for (const d of days) {
    if (isWeeklyOff(d, rule)) {
      out.add(d);
      continue;
    }
    if (allowance <= 0 || weekOffPatternOn(rule, d).kind !== "flexible") continue;
    if (d < today && !recorded.has(d) && !isHolidayFor(d, holidays, isOffice) && (!startDate || d >= startDate)) {
      out.add(d);
      allowance -= 1;
    }
  }
  return out;
}

/**
 * True when the early check-out rule doesn't apply on `date` for this member:
 * their weekly off (same weekOffDatesForMonth the month evaluation uses) or a
 * declared holiday for them (isHolidayFor). Such a day never becomes Half-Day.
 * `date` is the check-out day, which already has a row (checked in), so a
 * flexible member's month-level offs never include it.
 */
export function isEarlyCheckoutExemptDay(
  date: string,
  rule: WeekOffRule,
  holidays: OrgHoliday[],
  isOffice: boolean
): boolean {
  if (isHolidayFor(date, holidays, isOffice)) return true;
  return weekOffDatesForMonth(date.slice(0, 7), rule, [], holidays, isOffice, date).has(date);
}

/**
 * Sorts history rows (any order) into WeekOffRule["history"]. `kinds` are the
 * 0049 kind/anchor columns, read separately so a missing column only drops
 * them (every entry is then "fixed") instead of the whole history.
 */
export function toWeekOffHistory(
  rows: { dow: number; effective_from: string }[],
  kinds: { effective_from: string; kind?: string | null; anchor?: string | null }[] = []
): NonNullable<WeekOffRule["history"]> {
  const kindByFrom = new Map(kinds.map((k) => [k.effective_from, k]));
  return rows
    .map((r) => {
      const k = kindByFrom.get(r.effective_from);
      return {
        dow: r.dow,
        from: r.effective_from,
        ...(k ? { kind: toWeekOffKind(k.kind), ...(k.anchor ? { anchor: k.anchor } : {}) } : {}),
      };
    })
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

/** Swaps only make sense for fixed / alternate-Sunday offs. */
export const FLEXIBLE_SWAP_ERROR = "Flexible staff choose their own days off — no swap needed.";

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
  if (weekOffPatternOn(rule, workedDate).kind === "flexible" || weekOffPatternOn(rule, offDate).kind === "flexible") {
    return FLEXIBLE_SWAP_ERROR;
  }
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
 * without a record is not counted either way. Pass `weekOffDates` (the
 * month's weekOffDatesForMonth / evaluation.weekOffDates) so flexible offs
 * count; without it only isWeeklyOff decides. A no-record day before
 * `startDate` (when given) is "not_joined".
 */
export function dayStatus(
  date: string,
  hasRecord: boolean,
  today: string = orgToday(),
  isExtraHoliday: boolean = false,
  rule: WeekOffRule = SUNDAY_OFF,
  weekOffDates?: ReadonlySet<string>,
  startDate?: string
): DayStatus {
  if (hasRecord) return "present";
  if (isBeforeJoining(date, startDate)) return "not_joined";
  if ((weekOffDates ? weekOffDates.has(date) : isWeeklyOff(date, rule)) || isExtraHoliday) return "holiday";
  return date < today ? "absent" : "future";
}

export type ShiftCreditType =
  | "on_time"           // Any real check-in -> 1.0 day credit, no flag regardless of time
  | "manual_present"    // Admin marked without check_in_at -> 1.0 day credit
  | "leave"             // Admin explicitly marked Leave, within the paid allowance -> 1.0 day credit (paid)
  | "leave_unpaid"      // Office: 2nd+ day off this month -> 0 day credit, and retroactively so does the 1st. Site (from SITE_UNPAID_LEAVE_FROM): every Leave -> 0
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
  unpaidLeave: number;       // count of explicit Leave rows that are unpaid (office 2nd+ day off; any site Leave from SITE_UNPAID_LEAVE_FROM). Unpaid missed days are Absent, not counted here
  effectivePaidDays: number; // fullDays + 0.5 * halfDays
  /**
   * Office staff only (empty for Site): past working days with no record at
   * all — not a weekly off, not a declared holiday, before `today` — which
   * count toward the office days-off rule. Paid Leave when it's the month's
   * only day off; otherwise (2+ days off) they're Absent (unpaid) — see
   * `autoLeavePaid`.
   */
  autoLeaveDates: string[];
  /** Whether the `autoLeaveDates` are paid Leave (1 day off in the month) or Absent (2+). Meaningless when there are none. */
  autoLeavePaid: boolean;
  /** True when the member joined during this month (after the 1st): no automatic paid leave then. */
  joiningMonth: boolean;
  /** Office staff: days off counted toward the 1-paid-Leave rule (explicit Leave + auto-leave + Absent marks). 0 for Site. */
  daysOffCount: number;
  /** Every weekly-off date of the month (weekOffDatesForMonth) — incl. flexible offs, which isWeeklyOff alone can't see. */
  weekOffDates: Set<string>;
}

/**
 * Office auto-leave (missed working day = Leave) and the wider days-off count
 * (Absent marks, weekly-off exclusion) only apply from this date. Earlier days
 * keep the old rules exactly: a missed day is Absent, and only explicit Leave
 * counts toward the 2nd-Leave-makes-both-unpaid trigger.
 */
export const OFFICE_AUTO_LEAVE_FROM = "2026-10-01";

/** Site staff have no paid leave from this date: an explicit Leave is unpaid. Earlier Site Leave stays paid. */
export const SITE_UNPAID_LEAVE_FROM = "2026-10-01";

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
 * A past working day with no record at all (not a weekly off under `rule`,
 * not a declared holiday, before `today`) counts as Leave automatically —
 * an "auto-leave" day, see `autoLeaveDates`. Days off in the month = explicit
 * Leave + auto-leave + explicit Absent marks; a 2nd day off makes EVERY
 * Leave and auto-leave day that month unpaid (not just the extra one), so
 * the whole month is re-evaluated as a unit rather than deciding each Leave
 * record in isolation as it's reached. Absent marks stay Absent (never
 * Leave) but still count toward that 2nd day. Leave/Absent marks on a
 * weekly off or a declared holiday never count. When the days are unpaid
 * (2+ days off), the missed days are Absent, not Leave (same 0 credit).
 * Site staff: a missed day stays Absent, and from SITE_UNPAID_LEAVE_FROM an
 * explicit Leave is unpaid (no paid leave); before it Leave stays paid.
 *
 * Weekly offs come from weekOffDatesForMonth (so a flexible member's first N
 * missed days are offs, never missed days); pay treats them like Sundays.
 *
 * All of that only applies on/after OFFICE_AUTO_LEAVE_FROM, and missed days
 * also only from `startDate` (the member's join date, IST) when given —
 * before those dates the old rules hold (missed = Absent; only explicit
 * Leave counts).
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
  holidays: OrgHoliday[] = [],
  rule: WeekOffRule = SUNDAY_OFF,
  today: string = orgToday(),
  startDate?: string
): MonthlyAttendanceEvaluation {
  const monthRecords = records
    .filter((r) => r.date.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || a.checkInAt.localeCompare(b.checkInAt));

  const weekOffDates = weekOffDatesForMonth(month, rule, records, holidays, isOffice, today, startDate);
  // Declarative marks only — a self half_day (real punch) on a holiday is
  // handled by the half_day branch below (worked, paid in full).
  const isDeclaredHolidayRecord = (r: EmployeeAttendance) =>
    isDeclarativeRecord(r) && isHolidayFor(r.date, holidays, isOffice);
  // Which explicit marks count toward the 1-paid-Leave rule. Before
  // OFFICE_AUTO_LEAVE_FROM: Leave only (the old rule). From it: Leave and
  // Absent, but not on a weekly off. Never on a declared holiday.
  const countsAsLeaveDayOff = (r: EmployeeAttendance) =>
    r.status === "leave" && !isDeclaredHolidayRecord(r) && (r.date < OFFICE_AUTO_LEAVE_FROM || !weekOffDates.has(r.date));
  const countsAsAbsentDayOff = (r: EmployeeAttendance) =>
    r.status === "absent" && r.date >= OFFICE_AUTO_LEAVE_FROM && !isDeclaredHolidayRecord(r) && !weekOffDates.has(r.date);
  const totalLeaveCount = monthRecords.filter(countsAsLeaveDayOff).length;
  const recordedDates = new Set(monthRecords.map((r) => r.date));
  // Office only: past working days nobody recorded anything for, from the
  // policy start (and the member's own start, when known).
  const autoLeaveDates = isOffice
    ? daysOfMonth(month).filter(
        (d) =>
          d >= OFFICE_AUTO_LEAVE_FROM &&
          (!startDate || d >= startDate) &&
          d < today &&
          !recordedDates.has(d) &&
          !weekOffDates.has(d) &&
          !isHolidayFor(d, holidays, isOffice)
      )
    : [];
  const explicitAbsentCount = monthRecords.filter(countsAsAbsentDayOff).length;
  const daysOffCount = isOffice ? totalLeaveCount + autoLeaveDates.length + explicitAbsentCount : 0;
  const leavesAreUnpaid = isOffice && daysOffCount > 1;

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
      if (!isOffice && r.date >= SITE_UNPAID_LEAVE_FROM) {
        creditType = "leave_unpaid";
        dayCredit = 0;
        unpaidLeave += 1;
        badgeLabel = "Absent";
        glyph = "A";
        reason = `Site staff have no paid leave — marked Leave, counted as Absent.${r.note ? ` ${r.note}` : ""}`;
      } else if (leavesAreUnpaid) {
        creditType = "leave_unpaid";
        dayCredit = 0;
        unpaidLeave += 1;
        badgeLabel = "Absent";
        glyph = "A";
        reason =
          daysOffCount === totalLeaveCount
            ? `Office staff get 1 paid Leave per month — this is Leave #${
                monthRecords.filter((x) => countsAsLeaveDayOff(x) && x.date <= r.date).length
              } this month, so it (and the earlier one) is unpaid.${r.note ? ` ${r.note}` : ""}`
            : `${autoLeaveUnpaidReason(daysOffCount)}${r.note ? ` ${r.note}` : ""}`;
      } else {
        creditType = "leave";
        dayCredit = 1.0;
        fullDays += 1;
        badgeLabel = "Leave";
        glyph = "LV";
        reason = r.note ? `Marked Leave — ${r.note}` : "Marked Leave.";
      }
    } else if (
      r.status === "half_day" &&
      r.source === "self" &&
      (weekOffDates.has(r.date) || isHolidayFor(r.date, holidays, isOffice))
    ) {
      // A real punch on the member's weekly off or a declared holiday never
      // deducts (late-arrival or early-check-out Half-Day): worked, paid in full.
      creditType = "on_time";
      dayCredit = 1.0;
      fullDays += 1;
      badgeLabel = "Present";
      reason = `Worked on a ${weekOffDates.has(r.date) ? "weekly off" : "holiday"} — Half-Day not applied.${r.note ? ` ${r.note}` : ""}`;
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
  for (const date of daysOfMonth(month)) {
    if (date > today) break;
    if (recordedDates.has(date)) continue;
    if (startDate && date < startDate) continue; // not employed yet — not a paid holiday
    if (isHolidayFor(date, holidays, isOffice)) fullDays += 1;
  }

  // Auto-leave days have no row, so they're credited here: paid like an
  // explicit Leave when they're the month's only day off, else Absent (0).
  // No automatic paid leave in the month someone joins (user decision
  // 2026-10-30) — a missed day then is simply Absent.
  const joiningMonth = Boolean(startDate && startDate.slice(0, 7) === month && startDate > `${month}-01`);
  const autoLeavePaid = !leavesAreUnpaid && !joiningMonth;
  if (autoLeavePaid) fullDays += autoLeaveDates.length;

  const effectivePaidDays = fullDays + halfDays * 0.5;

  return {
    evaluatedRecords,
    recordMap,
    totalDaysAttended: monthRecords.length,
    fullDays,
    halfDays,
    unpaidLeave,
    effectivePaidDays,
    autoLeaveDates,
    autoLeavePaid,
    joiningMonth,
    daysOffCount,
    weekOffDates,
  };
}

function autoLeaveUnpaidReason(daysOff: number): string {
  return `Office staff get 1 paid Leave per month — ${daysOff} days off this month (incl. missed days / Absent), so all Leave is unpaid.`;
}

/**
 * How the UI shows a no-record day: paid Leave when it's the evaluation's
 * (office) auto-leave day and the month's only day off, else null — fall back
 * to the usual Absent / Holiday / Week Off rendering. Unpaid missed days
 * (2+ days off) are plain Absent; see missedAbsentReason for their tooltip.
 */
export function autoLeaveLabel(
  evaluation: MonthlyAttendanceEvaluation,
  date: string
): { label: "Leave"; glyph: "LV"; reason: string } | null {
  if (!evaluation.autoLeavePaid || !evaluation.autoLeaveDates.includes(date)) return null;
  return { label: "Leave", glyph: "LV", reason: "No attendance recorded — counted as Leave automatically (office staff get 1 paid Leave per month)." };
}

/** Office staff: why a missed working day is Absent (2+ days off this month) — null for any other day. */
export function missedAbsentReason(evaluation: MonthlyAttendanceEvaluation, date: string): string | null {
  if (evaluation.autoLeavePaid || !evaluation.autoLeaveDates.includes(date)) return null;
  if (evaluation.joiningMonth) return "No attendance recorded — Absent (no automatic paid leave in the month an employee joins).";
  return `No attendance recorded — Absent. Office staff get 1 paid Leave per month — ${evaluation.daysOffCount} days off this month (incl. missed days / Absent), so missed days are Absent and all Leave is unpaid.`;
}

export interface MonthlySummary {
  present: number;           // Full days (1.0 credits) — includes on-time, leave (within allowance), manual
  halfDay: number;           // Half days (0.5 credits) — explicit admin-marked Half-Day only
  effectivePaidDays: number; // present + 0.5 * halfDay
  leave: number;             // Paid Leave days (also counted in `present`'s paid-day weight)
  /** Always 0 now — an unpaid Leave is shown and counted as Absent. Kept for older callers. */
  unpaidLeave: number;
  absent: number;            // No-record working days (except an office member's paid auto-leave day) + explicit Absent days + unpaid Leave
  holiday: number;           // Declared company holidays only
  weekOff: number;           // Weekly off days (default day or swapped-in off day) not worked
  /** No-record days before the member's `startDate` — in no other bucket (not Absent / Holiday / Week Off). */
  notJoined: number;
  /**
   * The `notJoined` days that were counted as Absent before "not joined"
   * existed (past working days — not a weekly off or declared holiday).
   * Informational only: payroll treats every `notJoined` day as unpaid
   * (src/lib/payroll/paid-days.ts).
   */
  notJoinedUnpaid: number;
  /** Days actually worked (a Present row — real or manual punch). `present` also includes paid Leave and paid holidays. */
  worked: number;
  /** No-record working days from today on — not decided yet (not Absent, not paid so far). */
  upcoming: number;
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
  rule: WeekOffRule = SUNDAY_OFF,
  startDate?: string
): MonthlySummary {
  const evalResult = evaluateEmployeeMonthAttendance(records, month, isOffice, holidays, rule, today, startDate);
  // Days with an explicit-absent or declared-holiday row already have a
  // record, so dayStatus() (which only knows "does a row exist") would
  // wrongly call them present — count them separately and add them in.
  const explicitAbsentDates = new Set(
    evalResult.evaluatedRecords.filter((e) => e.creditType === "explicit_absent").map((e) => e.record.date)
  );
  const declaredHolidayDates = new Set(
    evalResult.evaluatedRecords.filter((e) => e.creditType === "declared_holiday").map((e) => e.record.date)
  );
  const autoLeaveDates = new Set(evalResult.autoLeaveDates);
  // Paid auto-leave days count as Leave; unpaid ones are Absent (counted in the loop).
  const leave =
    evalResult.evaluatedRecords.filter((e) => e.creditType === "leave").length +
    (evalResult.autoLeavePaid ? autoLeaveDates.size : 0);
  const recorded = new Set(records.filter((r) => r.date.startsWith(month)).map((r) => r.date));
  let absent = 0;
  let holiday = 0;
  let weekOff = 0;
  let notJoined = 0;
  let notJoinedUnpaid = 0;
  let upcoming = 0;

  for (const date of daysOfMonth(month)) {
    if (explicitAbsentDates.has(date)) {
      absent += 1;
      continue;
    }
    if (declaredHolidayDates.has(date)) {
      holiday += 1;
      continue;
    }
    if (evalResult.autoLeavePaid && autoLeaveDates.has(date)) continue; // office's only missed day: paid Leave (counted above)
    const isDeclared = isHolidayFor(date, holidays, isOffice);
    const status = dayStatus(date, recorded.has(date), today, isDeclared, rule, evalResult.weekOffDates, startDate);
    if (status === "not_joined") {
      notJoined += 1;
      // What the day was before "not joined" existed — keeps pay unchanged.
      if (dayStatus(date, false, today, isDeclared, rule, evalResult.weekOffDates) === "absent") notJoinedUnpaid += 1;
    } else if (status === "absent") absent += 1;
    else if (status === "future") upcoming += 1;
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
    unpaidLeave: 0,
    // An unpaid Leave (office 2nd+ day off; any site Leave) is shown as Absent.
    absent: absent + evalResult.unpaidLeave,
    holiday,
    weekOff,
    notJoined,
    notJoinedUnpaid,
    worked: evalResult.evaluatedRecords.filter((e) => e.creditType === "on_time" || e.creditType === "manual_present").length,
    upcoming,
  };
}
