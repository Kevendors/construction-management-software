import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { canAccess, landingPath, pathModule } from "@/lib/auth/permissions";
import type { Role } from "@/lib/types";

/**
 * Refreshes the Supabase auth session on every request and gates the app
 * behind login — but ONLY when Supabase is configured. With no env vars
 * (e.g. mock/demo deploys) it's a no-op so the app runs without auth.
 */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Public auth routes — never gated (reset-password is reached without a
  // full session, via the email recovery link).
  const isPublic = path === "/login" || path === "/reset-password";

  if (!user && !isPublic) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    return NextResponse.redirect(redirect);
  }

  if (user) {
    // Resolve role once to drive post-login landing + route guards.
    const { data: m } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = (m?.role as Role | undefined) ?? null;

    // Signed-in users leaving /login go to their role's landing page.
    if (path === "/login") {
      const redirect = request.nextUrl.clone();
      redirect.pathname = landingPath(role);
      return NextResponse.redirect(redirect);
    }

    // Bounce to the landing page if the role can't access this module.
    const module = pathModule(path);
    if (module && role && !canAccess(role, module)) {
      const dest = landingPath(role);
      if (dest !== path) {
        const redirect = request.nextUrl.clone();
        redirect.pathname = dest;
        return NextResponse.redirect(redirect);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    // run on everything except Next internals and static asset files
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
