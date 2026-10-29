import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dispatchNotification } from "@/lib/notifications/dispatch";
import { formatTime } from "@/lib/attendance/compute";
import { SPOT_CHECK_WINDOW_MIN } from "@/lib/attendance/spot-checks";
import { currentSitesFor } from "@/lib/attendance/site-visit-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TABLE = "attendance_spot_checks";

interface ActiveRow {
  id: string;
  org_id: string;
  user_id: string;
  project_id: string | null;
  attendance_id: string;
  status: "scheduled" | "pending";
  scheduled_at: string;
  notified_at: string | null;
  was_notified: boolean | null;
}

/**
 * Called every 5 min by Supabase pg_cron (migration 0045). Each run:
 * 1. cancels checks whose shift is already closed,
 * 2. fires due 'scheduled' checks → 'pending' + push to the employee,
 * 3. expires 'pending' checks past the 15-min window → 'missed' + alert
 *    Super Admin/HR.
 * Every update is guarded on the current status, so overlapping runs can't
 * double-send.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!isSupabaseConfigured()) return Response.json({ ok: true, skipped: "mock" });

  const admin = createAdminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const { data, error } = await admin
    .from(TABLE)
    .select("id, org_id, user_id, project_id, attendance_id, status, scheduled_at, notified_at, was_notified")
    .in("status", ["scheduled", "pending"]);
  if (error) {
    if (error.code === "PGRST205") return Response.json({ ok: true, skipped: "table pending" });
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as ActiveRow[];
  if (rows.length === 0) return Response.json({ ok: true, fired: 0, missed: 0, cancelled: 0 });

  // 1. Shifts already closed (punch-out, closed-previous-shift, admin edit).
  const attIds = Array.from(new Set(rows.map((r) => r.attendance_id)));
  const { data: atts, error: attError } = await admin
    .from("employee_attendance")
    .select("id, check_out_at")
    .in("id", attIds);
  if (attError) return Response.json({ ok: false, error: attError.message }, { status: 500 });
  const closed = new Set((atts ?? []).filter((a) => a.check_out_at).map((a) => a.id as string));
  const live = rows.filter((r) => !closed.has(r.attendance_id));
  let cancelled = 0;
  if (closed.size) {
    const { data: c } = await admin
      .from(TABLE)
      .update({ status: "cancelled" })
      .in("attendance_id", Array.from(closed))
      .in("status", ["scheduled", "pending"])
      .select("id");
    cancelled = c?.length ?? 0;
  }

  const windowMs = SPOT_CHECK_WINDOW_MIN * 60_000;
  const expired = live.filter(
    (r) => r.status === "pending" && r.notified_at && Date.parse(r.notified_at) + windowMs < now
  );

  // 2. Fire due checks — but not while the user still has an open one (it
  // stays 'scheduled' and fires next run), so two checks are never open at once.
  const expiredIds = new Set(expired.map((r) => r.id));
  const busyUsers = new Set(live.filter((r) => r.status === "pending" && !expiredIds.has(r.id)).map((r) => r.user_id));
  const due = live.filter(
    (r) => r.status === "scheduled" && Date.parse(r.scheduled_at) <= now && !busyUsers.has(r.user_id)
  );
  let fired = 0;
  if (due.length) {
    const { data: subs } = await admin
      .from("push_subscriptions")
      .select("user_id")
      .in("user_id", Array.from(new Set(due.map((r) => r.user_id))));
    const hasPush = new Set((subs ?? []).map((s) => s.user_id as string));
    for (const r of due) {
      const { data: u } = await admin
        .from(TABLE)
        .update({ status: "pending", notified_at: nowIso, was_notified: hasPush.has(r.user_id) })
        .eq("id", r.id)
        .eq("status", "scheduled")
        .select("id");
      if (!u?.length) continue;
      fired += 1;
      await dispatchNotification({
        orgId: r.org_id,
        userIds: [r.user_id],
        kind: "info",
        title: "Location check",
        body: `Tap to confirm you're on site — within ${SPOT_CHECK_WINDOW_MIN} minutes.`,
        href: "/attendance",
      });
    }
  }

  // 3. Expire unanswered checks.
  let missed = 0;
  if (expired.length) {
    const userIds = Array.from(new Set(expired.map((r) => r.user_id)));
    // Name the CURRENT site (after any Switch Site, 0050), not the check-in one.
    // Per org (the "Can work from office" lookup is org-scoped).
    const currentByAttendance = new Map<string, { projectId: string | null; atOffice: boolean }>();
    for (const orgId of Array.from(new Set(expired.map((r) => r.org_id)))) {
      const sites = await currentSitesFor(
        orgId,
        expired
          .filter((r) => r.org_id === orgId)
          .map((r) => ({ id: r.attendance_id, projectId: r.project_id, userId: r.user_id }))
      );
      sites.forEach((v, k) => currentByAttendance.set(k, v));
    }
    const siteIdOf = (r: ActiveRow) => currentByAttendance.get(r.attendance_id)?.projectId ?? r.project_id;
    const atOfficeOf = (r: ActiveRow) => currentByAttendance.get(r.attendance_id)?.atOffice === true;
    const projectIds = Array.from(new Set(expired.map(siteIdOf).filter(Boolean))) as string[];
    const [{ data: people }, { data: projects }] = await Promise.all([
      admin.from("profiles").select("id, name").in("id", userIds),
      projectIds.length
        ? admin.from("projects").select("id, name").in("id", projectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const nameOf = new Map((people ?? []).map((p) => [p.id as string, (p.name as string) || "An employee"]));
    const projectOf = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

    for (const r of expired) {
      const { data: u } = await admin
        .from(TABLE)
        .update({ status: "missed" })
        .eq("id", r.id)
        .eq("status", "pending")
        .select("id");
      if (!u?.length) continue;
      missed += 1;
      const siteId = siteIdOf(r);
      const site = atOfficeOf(r) ? "the Office" : siteId ? projectOf.get(siteId) ?? "site" : "site";
      await dispatchNotification({
        orgId: r.org_id,
        roles: ["super_admin", "hr"],
        kind: "delay",
        title: "Missed location check",
        body: `${nameOf.get(r.user_id) ?? "An employee"} didn't confirm their location at ${site} (sent ${formatTime(r.notified_at as string)})${
          r.was_notified === false ? " — notifications are off on their phone" : ""
        }.`,
        href: "/payroll",
      });
    }
  }

  return Response.json({ ok: true, fired, missed, cancelled });
}
