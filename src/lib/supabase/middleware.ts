import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getPublicEnv } from "@/lib/env";

export async function updateSession(request: NextRequest) {
  // Do not let a caller choose an authenticated rate-limit identity. A verified
  // user ID is added below only after Supabase validates the session.
  request.headers.delete("x-agency-rate-limit-user");
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    request.headers.set("x-agency-rate-limit-user", user.id);
    // Forward the trusted identity to Route Handlers while preserving any
    // session cookies that may have been refreshed by Supabase above.
    const refreshedResponse = NextResponse.next({ request });
    for (const cookie of response.cookies.getAll()) {
      refreshedResponse.cookies.set(cookie);
    }
    response = refreshedResponse;
  }
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register") || pathname.startsWith("/forgot-password") || pathname.startsWith("/reset-password") || pathname.startsWith("/admin/login") || pathname.startsWith("/auth");
  const isCronRoute = pathname === "/api/cron/automation";

  // Cron is intentionally sessionless; the route handler authenticates it with
  // CRON_SECRET instead of allowing the browser-session redirect to intercept it.
  if (!user && !isAuthRoute && !isCronRoute) return NextResponse.redirect(new URL("/login", request.url));
  if (user && ["/login", "/register", "/admin/login"].includes(pathname)) return NextResponse.redirect(new URL("/dashboard", request.url));
  if (user && (pathname.startsWith("/admin") || pathname.startsWith("/dashboard"))) {
    const { data: profile } = await supabase.from("profiles").select("is_active, roles!inner(code)").eq("id", user.id).maybeSingle();
    const roleValue = profile?.roles as unknown as { code: string } | { code: string }[] | undefined;
    const role = Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code;
    if (!profile?.is_active || !role) return NextResponse.redirect(new URL("/auth/error?code=inactive", request.url));
    if (pathname.startsWith("/admin") && role !== "admin") return NextResponse.redirect(new URL("/dashboard", request.url));
    if (pathname.startsWith("/dashboard") && role !== "employee") return NextResponse.redirect(new URL("/admin", request.url));
  }
  return response;
}
