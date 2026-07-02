import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server-only, bypasses RLS.
 * Used for privileged signup tasks (create confirmed user, enrol membership).
 * NEVER import this from a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
