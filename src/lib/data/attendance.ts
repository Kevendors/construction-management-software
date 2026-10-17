import "server-only";

import type { EmployeeAttendance, Role } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/auth/context";
import {
  orgThisMonth,
  orgToday,
  type AttendanceAdminBoard,
  type AttendanceMember,
  type MyAttendanceData,
  type OrgHoliday,
} from "@/lib/attendance/compute";
import { mapProject, type ProjectRow } from "./mappers";

// Re-export the client-safe board types for existing import sites.
export type { AttendanceAdminBoard, AttendanceMember, MyAttendanceData, OrgHoliday };

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
  userId: string
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from("memberships")
    .select("is_office")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.is_office as boolean | null | undefined) ?? null;
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
    return {
      today: mine.find((r) => r.date === today) ?? null,
      unclosedPreviousShift: null,
      records: mine
        .filter((r) => r.date.startsWith(activeMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
      assignedProjects: mockAssigned,
      hasExplicitProjectAssignment: mockAssigned.length > 0,
      isOffice: assignedIds.size === 0,
      officeGeofence: { lat: null, lng: null, radiusM: null },
      holidays: [],
      employeeId: "KV001",
      userName: mockCurrentUser.name,
      month: activeMonth,
    };
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return {
      today: null,
      unclosedPreviousShift: null,
      records: [],
      assignedProjects: [],
      hasExplicitProjectAssignment: false,
      isOffice: false,
      officeGeofence: { lat: null, lng: null, radiusM: null },
      holidays: [],
      employeeId: "",
      userName: "",
      month: activeMonth,
    };
  }

  const supabase = await createSupabase();
  const { from, to } = monthRange(activeMonth);
  // Explicit user_id filter: super_admin's RLS read is org-wide, but this
  // page is always "my own attendance".
  const [monthRes, todayRes, unclosedRes, pmRes, projRes, employeeId, isOfficeRaw, orgRes, holidaysRes] = await Promise.all([
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
    myIsOffice(supabase, ctx.userId),
    supabase.from("orgs").select("office_lat, office_lng, office_radius_m").eq("id", ctx.orgId).maybeSingle(),
    supabase.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
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

  // Show only the user's real roster. Someone with zero project_members rows
  // (regardless of role, including super_admin/pm) gets the office punch
  // flow instead of a project list — see hasExplicitProjectAssignment below.
  // (Previously this fell back to "every org project" for anyone unassigned;
  // the office flow now covers that case properly instead of handing them a
  // site-check-in project picker that was never a real fit for them.)
  const assignedProjects = projects.filter((p) => assignedIds.has(p.id));
  const officeRow = orgRes?.data as { office_lat: number | null; office_lng: number | null; office_radius_m: number | null } | null;
  const holidays = (holidaysRes?.data ?? []).map((h) => ({
    date: (h as { date: string }).date,
    label: (h as { label: string | null }).label ?? "Holiday",
    appliesTo: (h as { applies_to: "all" | "office" }).applies_to,
  }));

  return {
    today: todayRow ? mapEmployeeAttendance(todayRow, identityFor(todayRow)) : null,
    unclosedPreviousShift: unclosedRow ? mapEmployeeAttendance(unclosedRow, identityFor(unclosedRow)) : null,
    records: monthRows.map((r) => mapEmployeeAttendance(r, identityFor(r))),
    assignedProjects,
    hasExplicitProjectAssignment: assignedIds.size > 0,
    // Explicit per-member setting (Team page); falls back to the old
    // project-assignment inference only pre-migration (0039 not yet applied).
    isOffice: isOfficeRaw ?? assignedIds.size === 0,
    officeGeofence: {
      lat: officeRow?.office_lat ?? null,
      lng: officeRow?.office_lng ?? null,
      radiusM: officeRow?.office_radius_m ?? null,
    },
    holidays,
    employeeId,
    userName: ctx.name,
    month: activeMonth,
  };
}

/**
 * Org-wide board for the Payroll → Attendance tab. Self-gated to
 * super_admin/hr (the /payroll route is middleware-guarded too) and uses the
 * admin client for the memberships/profiles join, like the Team page.
 */
export async function getAttendanceAdminBoard(): Promise<AttendanceAdminBoard> {
  if (!isSupabaseConfigured()) {
    const rosterUserIds = new Set(mockProjectMembers.map((pm) => pm.userId));
    return {
      records: [...mockEmployeeAttendance].sort((a, b) => b.date.localeCompare(a.date)),
      members: mockUsers.map((u, i) => ({
        userId: u.id,
        name: u.name,
        employeeId: `KV${String(i + 1).padStart(3, "0")}`,
        role: u.role,
        isOffice: !rosterUserIds.has(u.id),
      })),
      holidays: [],
    };
  }

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { records: [], members: [], holidays: [] };
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
  memRows = memRows.filter((m) => m.is_active ?? true);

  const ids = memRows.map((m) => m.user_id);
  const [profRes, attRes, pmRes, holidaysRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("employee_attendance")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("date", { ascending: false }),
    admin.from("project_members").select("user_id").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin.from("org_holidays").select("date, label, applies_to").eq("org_id", ctx.orgId),
  ]);
  if (attRes.error) throw attRes.error;

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
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const holidays = (holidaysRes.data ?? []).map((h) => ({
    date: (h as { date: string }).date,
    label: (h as { label: string | null }).label ?? "Holiday",
    appliesTo: (h as { applies_to: "all" | "office" }).applies_to,
  }));

  return {
    records: ((attRes.data ?? []) as EmployeeAttendanceRow[]).map((r) => {
      const m = memberById.get(r.user_id);
      return mapEmployeeAttendance(r, {
        name: m?.name ?? "User",
        employeeId: m?.employeeId ?? "",
        markedByName: r.marked_by ? nameById.get(r.marked_by) ?? "Admin" : undefined,
      });
    }),
    members,
    holidays,
  };
}
