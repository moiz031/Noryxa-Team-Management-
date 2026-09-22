import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL("/auth/error?code=callback", url.origin));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login?error=unauthenticated", url.origin));
    const { data: profile, error: profileError } = await supabase.from("profiles").select("is_active, roles!inner(code)").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return NextResponse.redirect(new URL("/auth/error?code=missing_profile", url.origin));
    if (!profile.is_active) return NextResponse.redirect(new URL("/auth/error?code=inactive", url.origin));
    const roleValue = profile.roles as unknown as { code: string } | { code: string }[];
    const role = Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code;
    const requestedNext = url.searchParams.get("next");
    const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
    if (role === "admin") return NextResponse.redirect(new URL(next ?? "/admin", url.origin));
    if (role === "employee") return NextResponse.redirect(new URL(next ?? "/dashboard", url.origin));
    return NextResponse.redirect(new URL("/auth/error?code=invalid_role", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
}
