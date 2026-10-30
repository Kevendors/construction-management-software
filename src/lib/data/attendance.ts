import "server-only";

import type { EmployeeAttendance, Role } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/context";
import { isExternalRole } from "@/lib/auth/roles";
import {
  orgDateOf,
  orgThisMonth,
  orgToday,
  SUNDAY_OFF,
  toWeekOffHistory,
  toWeekOffKind,
  type AttendanceAdminBoard,
  type AttendanceMember,
  type MyAttendanceData,
  type OrgHoliday,
  type WeekOffRule,
  type WeekOffSwap,
} from "@/lib/attendance/compute";
import { mapProject, mapSpotCheck, type ProjectRow, type SpotCheckRow } from "./mappers";
import { OFFICE_SITE_NAME } from "@/lib/attendance/site-visits";

// Re-export the client-safe board types for existing import sites.
export type { AttendanceAdminBoard, AttendanceMember, MyAttendanceData, OrgHoliday, WeekOffSwap };

// mock fallback
import {
  currentUser as mockCurrentUser,
  employeeAttendance as mockEmployeeAttendance,
  projectMembers as mockProjectMembers,
  projects as mockProjects,
  users as mockUsers,
} from "@/lib/mock/data";

export interface EmployeeAttendanceRow {
  id: string;
  user_id: string;
  project_id: string | null;
  date: string;
  check_in_at: string;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_in_selfie_path: string | null;
  check_out_at: string | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_out_selfie_path: string | null;
  total_minutes: number | null;
  overtime_minutes: number | null;
  // Optional: absent pre-migration-0017 (select("*") just omits them, no error).
  source?: string | null;
  marked_by?: string | null;
  note?: string | null;
  // present/half_day/leave/absent — column exists since 0016 ("present" by
  // default), typed optional defensively like the others above.
  status?: string | null;
}

/**
 * Identity fields come from memberships/profiles, joined in by the caller.
 * `markedByName` only matters when the row's source is "admin".
 */
export const mapEmployeeAttendance = (
  r: EmployeeAttendanceRow,
  identity: { name: string; employeeId: string; markedByName?: string }
): EmployeeAttendance => {
  const source: "self" | "admin" = r.source === "admin" ? "admin" : "self";
  return {
    id: r.id,
    userId: r.user_id,
    employeeId: identity.employeeId,
    userName: identity.name,
    projectId: r.project_id ?? "",
    date: r.date,
    checkInAt: r.check_in_at,
    checkInLat: r.check_in_lat,
    checkInLng: r.check_in_lng,
    checkInSelfiePath: r.check_in_selfie_path ?? "",
    checkOutAt: r.check_out_at ?? "",
    checkOutLat: r.check_out_lat,
    checkOutLng: r.check_out_lng,
    checkOutSelfiePath: r.check_out_selfie_path ?? "",
    totalMinutes: r.total_minutes ?? 0,
    overtimeMinutes: r.overtime_minutes ?? 0,
    source,
    markedByName: source === "admin" ? (identity.markedByName ?? "") : "",
    note: r.note ?? "",
    status: (r.status === "half_day" || r.status === "leave" || r.status === "absent" ? r.status : "present"),
  };
};

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${month}-01`, to: `${next}-01` };
};

/**
 * The caller's own membership employee_id (KV###). Tolerates the column not
 * existing yet (migration 0015 unapplied) — same approach as the Team page.
 */
async function myEmployeeId(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("memberships")
    .select("employee_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) return "";
  return (data?.employee_id as string | null | undefined) ?? "";
}

/**
 * The caller's own explicit Office/Site setting (Team page), independent of
 * project assignment. Returns null if the column doesn't exist yet
 * (migration 0039 unapplied) so the caller can fall back to the old
 * project-assignment inference.
 */
async function myIsOffice(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string,
  orgId: string | null
): Promise<boolean | null> {
  // Scoped to the current org, like the admin board payroll reads from.
  let query = supabase.from("memberships").select("is_office").eq("user_id", userId);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return null;
  return (data?.is_office as boolean | null | undefined) ?? null;
}

/** 0051: the caller's "Client visits allowed" tick. Missing column = false. */
async function myClientVisitsAllowed(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string,
  orgId: string | null
): Promise<boolean> {
  let query = supabase.from("memberships").select("client_visits_allowed").eq("user_id", userId);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return false;
  return (data as { client_visits_allowed?: boolean | null } | null)?.client_visits_allowed === true;
}

/** 0050 addendum: the caller's "Can work from office" tick. Missing column = false. */
async function myCanWorkFromOffice(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string,
  orgId: string | null
): Promise<boolean> {
  let query = supabase.from("memberships").select("can_work_from_office").eq("user_id", userId);
  if (orgId) query = query.eq("org_id", orgId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return false;
  return data?.can_work_from_office === true;
}

type SwapRow = { user_id: string; worked_date: string; off_date: string };
type HistoryRow = { dow: number; effective_from: string };
/** 0049 columns, read in their own queries — missing = everyone "fixed". */
type HistoryKindRow = { effective_from: string; kind: string | null; anchor: string | null };
type KindRow = { weekly_off_kind: string | null; weekly_off_anchor: string | null };
const toSwap = (r: SwapRow) => ({ workedDate: r.worked_date, offDate: r.off_date });

/**
 * The caller's weekly off rule (0047): default day from memberships plus
 * their own swaps (RLS lets an employee read their own). Separate queries so
 * a missing column/table (0047 unapplied — 42703 / PGRST204 / PGRST205) just
 * falls back to SUNDAY_OFF instead of breaking the page. The 0049 kind /
 * anchor columns likewise: missing = "fixed".
 */
async function myWeekOff(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string
): Promise<WeekOffRule> {
  const [dowRes, swapsRes, historyRes, kindRes, historyKindRes] = await Promise.all([
    supabase.from("memberships").select("weekly_off_dow").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("attendance_week_off_swaps").select("user_id, worked_date, off_date").eq("user_id", userId),
    supabase.from("attendance_weekly_off_history").select("dow, effective_from").eq("user_id", userId),
    supabase.from("memberships").select("weekly_off_kind, weekly_off_anchor").eq("user_id", userId).limit(1).maybeSingle(),
    supabase.from("attendance_weekly_off_history").select("effective_from, kind, anchor").eq("user_id", userId),
  ]);
  const dow = dowRes.error ? null : (dowRes.data?.weekly_off_dow as number | null | undefined);
  const kind = kindRes.error ? null : (kindRes.data as KindRow | null);
  return {
    defaultDow: typeof dow === "number" ? dow : SUNDAY_OFF.defaultDow,
    kind: toWeekOffKind(kind?.weekly_off_kind),
    anchor: kind?.weekly_off_anchor ?? undefined,
    history: historyRes.error
      ? []
      : toWeekOffHistory(
          (historyRes.data ?? []) as HistoryRow[],
          historyKindRes.error ? [] : ((historyKindRes.data ?? []) as HistoryKindRow[])
        ),
    swaps: swapsRes.error ? [] : ((swapsRes.data ?? []) as SwapRow[]).map(toSwap),
  };
}

/**
 * The caller's join date (membership created_at, org-local "YYYY-MM-DD") —
 * the floor for office auto-leave. Any error just means no floor.
 */
/** The earlier of two optional "YYYY-MM-DD" dates. */
function earliestDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

async function myStartDate(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  userId: string,
  orgId: string | null
): Promise<string | undefined> {
  let query = supabase.from("memberships").select("created_at").eq("user_id", userId);
  if (orgId) query = query.eq("org_id", orgId);
  const [{ data, error }, { data: first }] = await Promise.all([
    query.limit(1).maybeSingle(),
    // Their first attendance ever: anyone with attendance before the
    // membership row was created was clearly already working.
    // Same org only — matches the admin board (allOrgAttendance), which payroll uses.
    (orgId
      ? supabase.from("employee_attendance").select("date").eq("user_id", userId).eq("org_id", orgId)
      : supabase.from("employee_attendance").select("date").eq("user_id", userId)
    )
      .order("date")
      .limit(1)
      .maybeSingle(),
  ]);
  if (error) return undefined;
  const created = orgDateOf((data?.created_at as string | null | undefined) ?? "") || undefined;
  return earliestDate(created, (first?.date as string | undefined) ?? undefined);
}

/**
 * Switch Site (0050): today's visits (RLS: own rows) plus the names of every
 * site involved, looked up org-scoped with the service role (unassigned Site
 * staff can't read projects through RLS). Any error — incl. the table not
 * existing yet (PGRST205 / 42P01) — just means "no visits".
 */
async function myTodaySites(
  supabase: Awaited<ReturnType<typeof createSupabase>>,
  orgId: string | null,
  todayRow: EmployeeAttendanceRow | null,
  /** "Can work from office" member: a null-project visit = the Office (else a since-deleted project). */
  officeAllowed: boolean
): Promise<Pick<MyAttendanceData, "todayVisits" | "todayProjectName">> {
  // Office check-ins included: a "Can work from office" member may check in
  // at the Office (project_id null) and switch to a project later.
  if (!todayRow || !orgId) return { todayVisits: [], todayProjectName: "" };
  const { data, error } = await supabase
    .from("attendance_site_visits")
    .select("id, project_id, arrived_at")
    .eq("attendance_id", todayRow.id)
    .order("arrived_at", { ascending: true });
  const rows = error ? [] : ((data ?? []) as { id: string; project_id: string | null; arrived_at: string }[]);
  const ids = Array.from(
    new Set([todayRow.project_id, ...rows.map((r) => r.project_id)].filter((p): p is string => Boolean(p)))
  );
  const { data: names } = ids.length
    ? await createAdminClient().from("projects").select("id, name").eq("org_id", orgId).in("id", ids)
    : { data: [] };
  const nameOf = new Map(((names ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  return {
    todayVisits: rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      // A null-project visit = the Office for a "Can work from office" member (0050 addendum).
      projectName: r.project_id ? nameOf.get(r.project_id) ?? "Site" : officeAllowed ? OFFICE_SITE_NAME : "Removed project",
      arrivedAt: r.arrived_at,
    })),
    todayProjectName: todayRow.project_id ? nameOf.get(todayRow.project_id) ?? "" : "",
  };
}

export async function getMyAttendancePage(month?: string): Promise<MyAttendanceData> {
  const activeMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? (month as string) : orgThisMonth();
  const today = orgToday();

  if (!isSupabaseConfigured()) {
    const mine = mockEmployeeAttendance.filter((r) => r.userId === mockCurrentUser.id);
    const assignedIds = new Set(
      mockProjectMembers.filter((m) => m.userId === mockCurrentUser.id).map((m) => m.projectId)
    );
    const mockAssigned =
      mockCurrentUser.role === "super_admin"
        ? mockProjects
        : mockProjects.filter((p) => assignedIds.has(p.id));
    const mockToday = mine.find((r) => r.date === today) ?? null;
    // Sample data: someone with project punches is Site (the demo super_admin
    // isn't rostered but checks in at a project) — demos Switch Site.
    const mockIsSite = assignedIds.size > 0 || mine.some((r) => r.projectId);
    return {
      today: mockToday,
      unclosedPreviousShift: null,
      pendingSpotCheck: null,
      todayVisits: [],
      todayProjectName: mockToday?.projectId ? mockProjects.find((p) => p.id === mockToday.projectId)?.name ?? "" : "",
      records: mine
        .filter((r) => r.date.startsWith(activeMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
      assignedProjects: mockAssigned,
      usesSiteFlow: mockIsSite,
      isOffice: !mockIsSite,
      // Sample data demos the "Office as a site" option for the Site user.
      canWorkFromOffice: mockIsSite,
      clientVisitsAllowed: false,
      officeGeofence: { lat: null, lng: null, radiusM: null },
      holidays: [],
      weekOff: SUNDAY_OFF,
      employeeId: "KV001",
      userName: mockCurrentUser.name,
      month: activeMonth,
    };
  }

  const ctx = await getAuthContext();
  // External users (clients / subcontractors) have no attendance — the
  // middleware already bounces them off /attendance; this is the backstop.
  if (!ctx || isExternalRole(ctx.role)) {
    return {
      today: null,
      unclosedPreviousShift: null,
      pendingSpotCheck: null,
      todayVisits: [],
      todayProjectName: "",
      records: [],
      assignedProjects: [],
      usesSiteFlow: false,
      isOffice: false,
      canWorkFromOffice: false,
      clientVisitsAllowed: false,
      officeGeofence: { lat: null, lng: null, radiusM: null },
      holidays: [],
      weekOff: SUNDAY_OFF,
      employeeId: "",
      userName: "",
      month: activeMonth,
    };
  }

  const supabase = await createSupabase();
  const { from, to } = monthRange(activeMonth);
  // Explicit user_id filter: super_admin's RLS read is org-wide, but this
  // page is always "my own attendance". The month query is one user's one
  // month (at most ~31 rows), so it needs no pagination past the 1000-row cap.
  const [monthRes, todayRes, unclosedRes, pmRes, projRes, employeeId, isOfficeRaw, orgRes, holidaysRes, pendingSpotRes, weekOff, startDate, canWorkFromOfficeRaw, clientVisitsAllowedRaw] = await Promise.all([
    supabase
      .from("employee_attendance")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("date", from)
      .lt("date", to)
      .order("date", { ascending: false }),
    supabase
      .from("employee_attendance")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("date", today)
      .maybeSingle(),
    // Only a real worked shift ("present") ever needs closing out -- a
    // declarative Leave/Half-Day/Absent row can carry a check_in_at timestamp
    // (e.g. midnight-anchored) with no check_out_at and that's correct as-is,
    // not an open shift waiting to be closed.
    supabase
      .from("employee_attendance")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("status", "present")
      .lt("date", today)
      .is("check_out_at", null)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("project_members").select("project_id").eq("user_id", ctx.userId),
    supabase.rpc("list_org_projects"),
    myEmployeeId(supabase, ctx.userId),
    myIsOffice(supabase, ctx.userId, ctx.orgId),
    supabase.from("orgs").select("office_lat, office_lng, office_radius_m").eq("id", ctx.orgId).maybeSingle(),
    supabase.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
    supabase
      .from("attendance_spot_checks")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("status", "pending")
      .order("notified_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    myWeekOff(supabase, ctx.userId),
    myStartDate(supabase, ctx.userId, ctx.orgId),
    myCanWorkFromOffice(supabase, ctx.userId, ctx.orgId),
    myClientVisitsAllowed(supabase, ctx.userId, ctx.orgId),
  ]);
  if (monthRes.error) throw monthRes.error;

  const monthRows = (monthRes.data ?? []) as EmployeeAttendanceRow[];
  const todayRow = todayRes.data as EmployeeAttendanceRow | null;
  const unclosedRow = unclosedRes?.data as EmployeeAttendanceRow | null;

  // Resolve names for any admin-marked rows (rare — usually 0, so this is a
  // small targeted query rather than joining profiles on every fetch).
  const markedByIds = Array.from(
    new Set(
      [...monthRows, ...(todayRow ? [todayRow] : []), ...(unclosedRow ? [unclosedRow] : [])]
        .filter((r) => r.source === "admin" && r.marked_by)
        .map((r) => r.marked_by as string)
    )
  );
  const markedByName = new Map<string, string>();
  if (markedByIds.length) {
    const { data: markers } = await supabase.from("profiles").select("id, name").in("id", markedByIds);
    for (const m of markers ?? []) markedByName.set(m.id as string, (m.name as string) || "Admin");
  }
  const identityFor = (r: EmployeeAttendanceRow) => ({
    name: ctx.name,
    employeeId,
    markedByName: r.marked_by ? markedByName.get(r.marked_by) ?? "Admin" : undefined,
  });

  const assignedIds = new Set(
    ((pmRes.data ?? []) as { project_id: string }[]).map((r) => r.project_id)
  );
  const projects = ((projRes.data ?? []) as ProjectRow[]).map(mapProject);

  // Office vs Site is the explicit per-member setting on the Team page;
  // falls back to the old project-assignment inference only pre-migration
  // (0039 not yet applied). Site staff get the project check-in flow — from
  // their roster, or from every open project if they aren't rostered yet
  // (unassigned is not the same as office).
  const isOffice = isOfficeRaw ?? assignedIds.size === 0;
  const rostered = projects.filter((p) => assignedIds.has(p.id));
  let assignedProjects = isOffice ? [] : rostered;
  if (!isOffice && rostered.length === 0) {
    // list_org_projects() only returns a non-super-admin's roster, so an
    // unassigned Site employee would see an empty picker. Load the org's open
    // projects with the service role instead (value hidden — it's admin-only).
    const { data: openRows } = await createAdminClient()
      .from("projects")
      .select("*")
      .eq("org_id", ctx.orgId)
      .neq("status", "completed")
      .order("name");
    assignedProjects = ((openRows ?? []) as ProjectRow[]).map((r) => ({ ...mapProject(r), value: 0 }));
  }
  const { todayVisits, todayProjectName } = await myTodaySites(supabase, ctx.orgId, todayRow, !isOffice && canWorkFromOfficeRaw);
  const officeRow = orgRes?.data as { office_lat: number | null; office_lng: number | null; office_radius_m: number | null } | null;
  const holidays = (holidaysRes?.data ?? []).map((h) => ({
    date: (h as { date: string }).date,
    label: (h as { label: string | null }).label ?? "Holiday",
    appliesTo: (h as { applies_to: "all" | "office" }).applies_to,
  }));

  return {
    today: todayRow ? mapEmployeeAttendance(todayRow, identityFor(todayRow)) : null,
    unclosedPreviousShift: unclosedRow ? mapEmployeeAttendance(unclosedRow, identityFor(unclosedRow)) : null,
    // Errors (incl. 0045 not applied yet) just mean "no pending check".
    pendingSpotCheck: pendingSpotRes?.data ? mapSpotCheck(pendingSpotRes.data as SpotCheckRow) : null,
    todayVisits,
    todayProjectName,
    records: monthRows.map((r) => mapEmployeeAttendance(r, identityFor(r))),
    assignedProjects,
    usesSiteFlow: !isOffice,
    isOffice,
    // Only Site members can use the Office as a site.
    canWorkFromOffice: !isOffice && canWorkFromOfficeRaw,
    // Only Office members punch away from the office (client visits).
    clientVisitsAllowed: isOffice && clientVisitsAllowedRaw,
    officeGeofence: {
      lat: officeRow?.office_lat ?? null,
      lng: officeRow?.office_lng ?? null,
      radiusM: officeRow?.office_radius_m ?? null,
    },
    holidays,
    weekOff,
    startDate,
    employeeId,
    userName: ctx.name,
    month: activeMonth,
  };
}

const PAGE_SIZE = 1000;

/**
 * Every attendance row in the org. PostgREST caps a response at 1000 rows, so
 * a single unbounded select silently drops the oldest ones — page through with
 * .range() until a page comes back short. Ordered by date then id so pages
 * never overlap or skip. Returns { data, error } like a single query would.
 */
async function allOrgAttendance(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string
): Promise<{ data: EmployeeAttendanceRow[]; error: unknown }> {
  const rows: EmployeeAttendanceRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from("employee_attendance")
      .select("*")
      .eq("org_id", orgId)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { data: rows, error };
    const page = (data ?? []) as EmployeeAttendanceRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}

/**
 * Org-wide board for the Payroll → Attendance tab. Self-gated to
 * super_admin/hr (the /payroll route is middleware-guarded too) and uses the
 * admin client for the memberships/profiles join, like the Team page.
 */
export async function getAttendanceAdminBoard(): Promise<AttendanceAdminBoard> {
  if (!isSupabaseConfigured()) {
    const rosterUserIds = new Set(mockProjectMembers.map((pm) => pm.userId));
    // Employees only — external users (clients / subcontractors) aren't in attendance.
    const mockExternalIds = new Set(mockUsers.filter((u) => isExternalRole(u.role)).map((u) => u.id));
    return {
      records: mockEmployeeAttendance
        .filter((r) => !mockExternalIds.has(r.userId))
        .sort((a, b) => b.date.localeCompare(a.date)),
      members: mockUsers
        .map((u, i) => ({
          userId: u.id,
          name: u.name,
          employeeId: `KV${String(i + 1).padStart(3, "0")}`,
          role: u.role,
          isOffice: !rosterUserIds.has(u.id),
          weekOff: SUNDAY_OFF,
        }))
        .filter((m) => !isExternalRole(m.role)),
      holidays: [],
      weekOffSwaps: [],
    };
  }

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { records: [], members: [], holidays: [], weekOffSwaps: [] };
  }

  const admin = createAdminClient();
  type MemRow = { user_id: string; role: Role; is_active?: boolean; employee_id?: string | null; is_office?: boolean | null };
  let memRows: MemRow[] = [];
  let hasIsOfficeColumn = true;
  const withEmployeeId = await admin
    .from("memberships")
    .select("user_id, role, is_active, employee_id, is_office")
    .eq("org_id", ctx.orgId);
  if (!withEmployeeId.error) {
    memRows = (withEmployeeId.data ?? []) as MemRow[];
  } else {
    // is_office column missing (0039 not applied) -- retry without it, and
    // fall back to the old project-assignment inference for isOffice below.
    hasIsOfficeColumn = false;
    const noOffice = await admin
      .from("memberships")
      .select("user_id, role, is_active, employee_id")
      .eq("org_id", ctx.orgId);
    if (!noOffice.error) {
      memRows = (noOffice.data ?? []) as MemRow[];
    } else {
      // employee_id column missing too (0015 not applied)
      const basic = await admin
        .from("memberships")
        .select("user_id, role, is_active")
        .eq("org_id", ctx.orgId);
      memRows = (basic.data ?? []) as MemRow[];
    }
  }
  // Employees only: external users (clients / subcontractors) have no
  // attendance. Their old rows stay in the DB but are dropped from the board
  // (members + records). Taken before the is_active filter so a disabled
  // external user's history is dropped too.
  const externalIds = new Set(memRows.filter((m) => isExternalRole(m.role)).map((m) => m.user_id));
  memRows = memRows.filter((m) => (m.is_active ?? true) && !externalIds.has(m.user_id));

  const ids = memRows.map((m) => m.user_id);
  const [profRes, attRes, pmRes, holidaysRes, dowRes, swapsRes, historyRes, startRes, kindRes, historyKindRes, wfoRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    allOrgAttendance(admin, ctx.orgId),
    admin.from("project_members").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
    // Weekly off (0047) — separate queries so a missing column/table just
    // falls back to SUNDAY_OFF below instead of breaking the board.
    admin.from("memberships").select("user_id, weekly_off_dow").eq("org_id", ctx.orgId),
    admin
      .from("attendance_week_off_swaps")
      .select("id, user_id, worked_date, off_date, note")
      .eq("org_id", ctx.orgId)
      .order("worked_date", { ascending: false }),
    admin.from("attendance_weekly_off_history").select("user_id, dow, effective_from").eq("org_id", ctx.orgId),
    // Join date = office auto-leave floor. Separate query: any error = no floor.
    admin.from("memberships").select("user_id, created_at").eq("org_id", ctx.orgId),
    // Weekly-off kind / anchor (0049) — own queries: missing columns = everyone "fixed".
    admin.from("memberships").select("user_id, weekly_off_kind, weekly_off_anchor").eq("org_id", ctx.orgId),
    admin.from("attendance_weekly_off_history").select("user_id, effective_from, kind, anchor").eq("org_id", ctx.orgId),
    // "Can work from office" (0050) — own query: a missing column = false for everyone.
    admin.from("memberships").select("user_id, can_work_from_office").eq("org_id", ctx.orgId),
  ]);
  const wfoIds = new Set(
    wfoRes.error
      ? []
      : ((wfoRes.data ?? []) as { user_id: string; can_work_from_office: boolean | null }[])
          .filter((r) => r.can_work_from_office === true)
          .map((r) => r.user_id)
  );
  if (attRes.error) throw attRes.error;

  // A member's start = the earlier of their membership creation and their
  // first attendance record (records before the account prove they worked).
  const firstRecordById = new Map<string, string>();
  for (const r of (attRes.data ?? []) as { user_id: string; date: string }[]) {
    const cur = firstRecordById.get(r.user_id);
    if (!cur || r.date < cur) firstRecordById.set(r.user_id, r.date);
  }
  const startById = new Map(
    startRes.error
      ? []
      : ((startRes.data ?? []) as { user_id: string; created_at: string | null }[]).map((r) => [
          r.user_id,
          earliestDate(orgDateOf(r.created_at ?? "") || undefined, firstRecordById.get(r.user_id)),
        ])
  );

  const dowById = new Map(
    dowRes.error
      ? []
      : ((dowRes.data ?? []) as { user_id: string; weekly_off_dow: number | null }[]).map((r) => [r.user_id, r.weekly_off_dow])
  );
  // Missing history table (0047 unapplied) = no history for anyone.
  const historyRowsById = new Map<string, HistoryRow[]>();
  if (!historyRes.error) {
    for (const r of (historyRes.data ?? []) as (HistoryRow & { user_id: string })[]) {
      historyRowsById.set(r.user_id, [...(historyRowsById.get(r.user_id) ?? []), r]);
    }
  }
  const kindById = new Map(
    kindRes.error ? [] : ((kindRes.data ?? []) as (KindRow & { user_id: string })[]).map((r) => [r.user_id, r])
  );
  const historyKindsById = new Map<string, HistoryKindRow[]>();
  if (!historyKindRes.error) {
    for (const r of (historyKindRes.data ?? []) as (HistoryKindRow & { user_id: string })[]) {
      historyKindsById.set(r.user_id, [...(historyKindsById.get(r.user_id) ?? []), r]);
    }
  }
  const weekOffSwaps: WeekOffSwap[] = swapsRes.error
    ? []
    : ((swapsRes.data ?? []) as (SwapRow & { id: string; note: string | null })[])
        .filter((r) => !externalIds.has(r.user_id))
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          workedDate: r.worked_date,
          offDate: r.off_date,
          note: r.note ?? "",
        }));
  const swapsById = new Map<string, WeekOffRule["swaps"]>();
  for (const sw of weekOffSwaps) {
    swapsById.set(sw.userId, [...(swapsById.get(sw.userId) ?? []), { workedDate: sw.workedDate, offDate: sw.offDate }]);
  }

  const nameById = new Map((profRes.data ?? []).map((p) => [p.id as string, (p.name as string) || "User"]));
  const rosterUserIds = new Set((pmRes.data ?? []).map((r) => (r as { user_id: string }).user_id));
  const members: AttendanceMember[] = memRows
    .map((m) => ({
      userId: m.user_id,
      name: nameById.get(m.user_id) ?? "User",
      employeeId: m.employee_id ?? "",
      role: m.role,
      // Explicit per-member setting (Team page), independent of project
      // assignment. Falls back to the old auto-inference only pre-migration.
      isOffice: hasIsOfficeColumn ? m.is_office ?? true : !rosterUserIds.has(m.user_id),
      canWorkFromOffice: wfoIds.has(m.user_id),
      weekOff: {
        defaultDow: dowById.get(m.user_id) ?? SUNDAY_OFF.defaultDow,
        kind: toWeekOffKind(kindById.get(m.user_id)?.weekly_off_kind),
        anchor: kindById.get(m.user_id)?.weekly_off_anchor ?? undefined,
        history: toWeekOffHistory(historyRowsById.get(m.user_id) ?? [], historyKindsById.get(m.user_id) ?? []),
        swaps: swapsById.get(m.user_id) ?? [],
      },
      startDate: startById.get(m.user_id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const holidays = (holidaysRes.data ?? []).map((h) => ({
    date: (h as { date: string }).date,
    label: (h as { label: string | null }).label ?? "Holiday",
    appliesTo: (h as { applies_to: "all" | "office" }).applies_to,
  }));

  return {
    records: ((attRes.data ?? []) as EmployeeAttendanceRow[])
      .filter((r) => !externalIds.has(r.user_id))
      .map((r) => {
        const m = memberById.get(r.user_id);
        return mapEmployeeAttendance(r, {
          name: m?.name ?? "User",
          employeeId: m?.employeeId ?? "",
          markedByName: r.marked_by ? nameById.get(r.marked_by) ?? "Admin" : undefined,
        });
      }),
    members,
    holidays,
    weekOffSwaps,
    // Holidays decide paid days and profiles decide name matching — if either
    // query failed, payroll must refuse rather than pay from partial data.
    ...(holidaysRes.error || profRes.error ? { incomplete: true } : {}),
  };
}
