"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface AuthResult {
  error?: string;
}

/**
 * Create a confirmed user via the admin API (so no email-confirmation step is
 * needed) and enrol them in the workspace org so RLS lets them see data.
 */
export async function signUpAction(
  email: string,
  password: string,
  name: string
): Promise<AuthResult> {
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) return { error: error.message };
  const userId = data.user?.id;
  if (!userId) return { error: "Could not create user." };

  // Enrol the new user in the single workspace org (required by RLS).
  const { data: org } = await admin
    .from("orgs")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (org?.id) {
    await admin
      .from("memberships")
      .upsert(
        { org_id: org.id, user_id: userId, role: "super_admin" },
        { onConflict: "org_id,user_id" }
      );
  }

  return {};
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
