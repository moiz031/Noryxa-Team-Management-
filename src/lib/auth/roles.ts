import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthContext, type AppRole, type AuthContext } from "@/lib/auth/context";

export { getAuthContext, isAdmin, isEmployee } from "@/lib/auth/context";
export type { AppRole, AuthContext } from "@/lib/auth/context";

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(`Authentication lookup failed: ${error.message}`);
  return user;
}

export async function requireUser(): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) { redirect("/login"); throw new Error("Authentication required"); }
  return context;
}

export async function requireAuth() {
  const context = await getAuthContext();
  if (!context) throw new Error("Authentication required");
  return { ...context, supabase: await createSupabaseServerClient() };
}

export async function requireRole(role: AppRole) {
  const context = await requireUser();
  if (context.role !== role) redirect(role === "admin" ? "/dashboard" : "/admin");
  return context;
}

export async function requireAdmin() { return requireRole("admin"); }
export async function requireEmployee() { return requireRole("employee"); }
