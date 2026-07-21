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
} from "@/lib/attendance/compute";
import { mapProject, type ProjectRow } from "./mappers";

// Re-export the client-safe board types for existing import sites.
export type { AttendanceAdminBoard, AttendanceMember, MyAttendanceData };

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
}

/** Identity fields come from memberships/profiles, joined in by the caller. */
export const mapEmployeeAttendance = (
  r: EmployeeAttendanceRow,
  identity: { name: string; employeeId: string }
): EmployeeAttendance => ({
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
});

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

export async function getMyAttendancePage(month?: string): Promise<MyAttendanceData> {
  const activeMonth = /^\d{4}-\d{2}$/.test(month ?? "") ? (month as string) : orgThisMonth();
  const today = orgToday();

  if (!isSupabaseConfigured()) {
    const mine = mockEmployeeAttendance.filter((r) => r.userId === mockCurrentUser.id);
    const assignedIds = new Set(
      mockProjectMembers.filter((m) => m.userId === mockCurrentUser.id).map((m) => m.projectId)
    );
    return {
      today: mine.find((r) => r.date === today) ?? null,
      records: mine
        .filter((r) => r.date.startsWith(activeMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
      assignedProjects:
        mockCurrentUser.role === "super_admin"
          ? mockProjects
          : mockProjects.filter((p) => assignedIds.has(p.id)),
      employeeId: "KV001",
      userName: mockCurrentUser.name,
      month: activeMonth,
    };
  }

  const ctx = await getAuthContext();
  if (!ctx) {
    return { today: null, records: [], assignedProjects: [], employeeId: "", userName: "", month: activeMonth };
  }

  const supabase = await createSupabase();
  const { from, to } = monthRange(activeMonth);
  // Explicit user_id filter: super_admin's RLS read is org-wide, but this
  // page is always "my own attendance".
  const [monthRes, todayRes, pmRes, projRes, employeeId] = await Promise.all([
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
    supabase.from("project_members").select("project_id").eq("user_id", ctx.userId),
    supabase.rpc("list_org_projects"),
    myEmployeeId(supabase, ctx.userId),
  ]);
  if (monthRes.error) throw monthRes.error;

  const identity = { name: ctx.name, employeeId };
  const assignedIds = new Set(
    ((pmRes.data ?? []) as { project_id: string }[]).map((r) => r.project_id)
  );
  const projects = ((projRes.data ?? []) as ProjectRow[]).map(mapProject);

  return {
    today: todayRes.data
      ? mapEmployeeAttendance(todayRes.data as EmployeeAttendanceRow, identity)
      : null,
    records: ((monthRes.data ?? []) as EmployeeAttendanceRow[]).map((r) =>
      mapEmployeeAttendance(r, identity)
    ),
    assignedProjects:
      ctx.role === "super_admin" ? projects : projects.filter((p) => assignedIds.has(p.id)),
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
    return {
      records: [...mockEmployeeAttendance].sort((a, b) => b.date.localeCompare(a.date)),
      members: mockUsers.map((u, i) => ({
        userId: u.id,
        name: u.name,
        employeeId: `KV${String(i + 1).padStart(3, "0")}`,
        role: u.role,
      })),
    };
  }

  const ctx = await getAuthContext();
  if (!ctx?.orgId || !(ctx.role === "super_admin" || ctx.role === "hr")) {
    return { records: [], members: [] };
  }

  const admin = createAdminClient();
  type MemRow = { user_id: string; role: Role; is_active?: boolean; employee_id?: string | null };
  let memRows: MemRow[] = [];
  const withEmployeeId = await admin
    .from("memberships")
    .select("user_id, role, is_active, employee_id")
    .eq("org_id", ctx.orgId);
  if (!withEmployeeId.error) {
    memRows = (withEmployeeId.data ?? []) as MemRow[];
  } else {
    // employee_id column missing (0015 not applied)
    const basic = await admin
      .from("memberships")
      .select("user_id, role, is_active")
      .eq("org_id", ctx.orgId);
    memRows = (basic.data ?? []) as MemRow[];
  }
  memRows = memRows.filter((m) => m.is_active ?? true);

  const ids = memRows.map((m) => m.user_id);
  const [profRes, attRes] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .from("employee_attendance")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("date", { ascending: false }),
  ]);
  if (attRes.error) throw attRes.error;

  const nameById = new Map((profRes.data ?? []).map((p) => [p.id as string, (p.name as string) || "User"]));
  const members: AttendanceMember[] = memRows
    .map((m) => ({
      userId: m.user_id,
      name: nameById.get(m.user_id) ?? "User",
      employeeId: m.employee_id ?? "",
      role: m.role,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const memberById = new Map(members.map((m) => [m.userId, m]));

  return {
    records: ((attRes.data ?? []) as EmployeeAttendanceRow[]).map((r) => {
      const m = memberById.get(r.user_id);
      return mapEmployeeAttendance(r, {
        name: m?.name ?? "User",
        employeeId: m?.employeeId ?? "",
      });
    }),
    members,
  };
}
