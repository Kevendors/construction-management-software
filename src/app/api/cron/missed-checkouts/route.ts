import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { orgToday } from "@/lib/attendance/compute";
import { isExternalRole } from "@/lib/auth/roles";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NAMES_IN_ALERT = 5;

const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

/**
 * Called daily at 10:00 AM IST by Supabase pg_cron (migration 0053). Sends one
 * summary alert per org to Super Admin/HR while any shift from an earlier date
 * has no check-out (active employees only). Repeats daily until they're closed.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isSupabaseConfigured()) return Response.json({ ok: true, skipped: "mock" });

  const admin = createAdminClient();
  // Same rows as isMissedCheckout: real punches, not declarative Half-Day/Leave/Absent days.
  const { data, error } = await admin
    .from("employee_attendance")
    .select("org_id, user_id, date")
    .lt("date", orgToday())
    .is("check_out_at", null)
    .or("status.eq.present,source.eq.self")
    .order("date", { ascending: false });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as { org_id: string; user_id: string; date: string }[];
  if (rows.length === 0) return Response.json({ ok: true, pending: 0 });

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const [{ data: mems, error: memError }, { data: profiles }] = await Promise.all([
    admin.from("memberships").select("org_id, user_id, role, is_active").in("user_id", userIds),
    admin.from("profiles").select("id, name").in("id", userIds),
  ]);
  if (memError) return Response.json({ ok: false, error: memError.message }, { status: 500 });
  const activeEmployees = new Set(
    ((mems ?? []) as { org_id: string; user_id: string; role: Role; is_active: boolean | null }[])
      .filter((m) => (m.is_active ?? true) && !isExternalRole(m.role))
      .map((m) => `${m.org_id}:${m.user_id}`)
  );
  const nameOf = new Map(((profiles ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name || "User"]));

  const byOrg = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!activeEmployees.has(`${r.org_id}:${r.user_id}`)) continue;
    byOrg.set(r.org_id, [...(byOrg.get(r.org_id) ?? []), r]);
  }

  let pending = 0;
  for (const [orgId, list] of byOrg) {
    pending += list.length;
    const shown = list.slice(0, NAMES_IN_ALERT).map((r) => `${nameOf.get(r.user_id) ?? "User"} (${shortDate(r.date)})`);
    const more = list.length - shown.length;
    await dispatchNotification({
      orgId,
      roles: ["super_admin", "hr"],
      kind: "delay",
      title: `${list.length} missed check-out${list.length === 1 ? "" : "s"} pending`,
      body: `${shown.join(", ")}${more > 0 ? ` and ${more} more` : ""}. Please review and close.`,
      href: "/payroll?tab=attendance",
    });
  }

  return Response.json({ ok: true, pending });
}
