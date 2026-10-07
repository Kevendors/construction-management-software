import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side Supabase client (Server Components, Server Actions, Route Handlers).
 * Wires Supabase Auth into Next's cookie store so RLS sees the signed-in user.
 * Memoized per-request with React cache() to reuse the client instance within a single request.
 */
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // called from a Server Component — middleware refreshes the session instead.
          }
        },
      },
    }
  );
});
