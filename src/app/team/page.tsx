import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { toWeekOffKind } from "@/lib/attendance/compute";
import { TeamBoard, type TeamMember } from "@/components/team/team-board";
import type { Role } from "@/lib/types";

// Reads the current session (cookies) — render on demand, never prebuild.
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const ctx = await getAuthContext();

  if (!ctx || !isAdminRole(ctx.role)) {
    return (
      <>
        <PageHeader title="Team & Roles" description="Manage user accounts and their roles" />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <p className="text-sm">You don&apos;t have access to Team management.</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const admin = createAdminClient();

  // Tolerate the pre-Migration-A schema (no is_active column) so the page never
  // crashes; show a banner prompting the migration instead. can_view_purchase_
  // orders (0013) is loaded when present and defaults to false otherwise.
  let migrationPending = false;
  type MemRow = {
    user_id: string;
    role: Role;
    is_active?: boolean;
    can_view_purchase_orders?: boolean;
    employee_id?: string | null;
    is_office?: boolean;
  };
  let memberships: MemRow[] = [];
  const withEmployeeId = await admin
    .from("memberships")
    .select("user_id, role, is_active, can_view_purchase_orders, employee_id, is_office")
    .eq("org_id", ctx.orgId);
  if (!withEmployeeId.error) {
    memberships = (withEmployeeId.data ?? []) as MemRow[];
  } else {
    // employee_id column missing (0015 not applied) — keep is_active/PO display
    const withActive = await admin
      .from("memberships")
      .select("user_id, role, is_active, can_view_purchase_orders")
      .eq("org_id", ctx.orgId);
    if (withActive.error) {
      migrationPending = true;
      const basic = await admin.from("memberships").select("user_id, role").eq("org_id", ctx.orgId);
      memberships = (basic.data ?? []) as MemRow[];
    } else {
      memberships = (withActive.data ?? []) as MemRow[];
    }
  }

  const rows = memberships;
  const ids = rows.map((m) => m.user_id);

  // Weekly off day (0047) — its own query so a missing column just leaves
  // everyone on the Sunday default instead of tripping the fallbacks above.
  const { data: dowRows, error: dowErr } = await admin
    .from("memberships")
    .select("user_id, weekly_off_dow")
    .eq("org_id", ctx.orgId);
  const dowById = new Map(
    dowErr ? [] : ((dowRows ?? []) as { user_id: string; weekly_off_dow: number | null }[]).map((r) => [r.user_id, r.weekly_off_dow])
  );
  // Weekly-off type (0049) — its own query too: a missing column = everyone "fixed".
  const { data: kindRows, error: kindErr } = await admin
    .from("memberships")
    .select("user_id, weekly_off_kind, weekly_off_anchor")
    .eq("org_id", ctx.orgId);
  const kindById = new Map(
    kindErr
      ? []
      : ((kindRows ?? []) as { user_id: string; weekly_off_kind: string | null; weekly_off_anchor: string | null }[]).map(
          (r) => [r.user_id, r]
        )
  );

  // "Can work from office" (0050) — its own query: a missing column = false
  // for everyone and the tick is disabled.
  const { data: wfoRows, error: wfoErr } = await admin
    .from("memberships")
    .select("user_id, can_work_from_office")
    .eq("org_id", ctx.orgId);
  const wfoIds = new Set(
    wfoErr
      ? []
      : ((wfoRows ?? []) as { user_id: string; can_work_from_office: boolean | null }[])
          .filter((r) => r.can_work_from_office === true)
          .map((r) => r.user_id)
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name")
    .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const nameById = new Map((profiles ?? []).map((p) => [p.id as string, p.name as string]));

  const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const authById = new Map((usersList?.users ?? []).map((u) => [u.id, u]));

  const members: TeamMember[] = rows.map((m) => {
    const au = authById.get(m.user_id);
    const meta = (au?.user_metadata ?? {}) as { name?: string; phone?: string };
    const email = au?.email ?? "";
    return {
      userId: m.user_id,
      name: nameById.get(m.user_id) || meta.name || email.split("@")[0] || "User",
      phone: meta.phone || au?.phone || "",
      // hide the internal login-alias email (…@sitehub.phone)
      email: email.endsWith("@sitehub.phone") ? "" : email,
      role: m.role,
      isActive: m.is_active ?? true,
      canViewPurchaseOrders: m.can_view_purchase_orders ?? false,
      employeeId: m.employee_id ?? "",
      isOffice: m.is_office ?? true,
      canWorkFromOffice: wfoIds.has(m.user_id),
      weeklyOffDow: dowById.get(m.user_id) ?? 0,
      weeklyOffKind: toWeekOffKind(kindById.get(m.user_id)?.weekly_off_kind),
      weeklyOffAnchor: kindById.get(m.user_id)?.weekly_off_anchor ?? "",
    };
  });

  members.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <TeamBoard
      members={members}
      currentUserId={ctx.userId}
      migrationPending={migrationPending}
      weekOffPending={Boolean(dowErr)}
      weekOffKindsPending={Boolean(kindErr)}
      workFromOfficePending={Boolean(wfoErr)}
      canEditWorkFromOffice={ctx.role === "super_admin"}
    />
  );
}
