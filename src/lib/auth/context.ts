import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/types";

export interface AuthContext {
  userId: string;
  orgId: string | null;
  role: Role | null;
  name: string;
  email: string;
  isActive: boolean;
}

/**
 * Resolve the signed-in user's org + role from a single membership lookup.
 * Central replacement for the per-file currentOrgId()/currentContext() helpers.
 * Returns null when not signed in.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Select only always-present columns so this works before/after Migration A.
  const { data } = await supabase
    .from("memberships")
    .select("org_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const meta = user.user_metadata ?? {};
  const name =
    (meta.name as string | undefined) || user.email?.split("@")[0] || user.phone || "User";

  return {
    userId: user.id,
    orgId: (data?.org_id as string | undefined) ?? null,
    role: (data?.role as Role | undefined) ?? null,
    name,
    email: user.email ?? "",
    isActive: true, // enforced once Migration A + role-aware RLS land
  };
}
