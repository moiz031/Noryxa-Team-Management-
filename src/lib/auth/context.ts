import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "employee";

export type AuthContext = {
  user: { id: string; email?: string };
  profile: {
    id: string;
    email: string | null;
    full_name: string | null;
    is_active: boolean;
    roles: { code: AppRole } | { code: AppRole }[];
    employees: { id: string; employment_status: string; department_id: string | null }[] | null;
  };
  role: AppRole;
};

export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Authentication lookup failed: ${userError.message}`);
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_active, roles!inner(code), employees!employees_profile_id_fkey(id, employment_status, department_id)")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
  if (!profile) return null;

  const roleValue = profile.roles as unknown as { code: AppRole } | { code: AppRole }[] | null;
  const role = (Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code);
  if (role !== "admin" && role !== "employee") throw new Error("Invalid account role");
  if (!profile.is_active) throw new Error("Account is inactive");
  return { user: { id: user.id, email: user.email }, profile: profile as AuthContext["profile"], role };
}

export async function isAdmin() {
  return (await getAuthContext())?.role === "admin";
}

export async function isEmployee() {
  return (await getAuthContext())?.role === "employee";
}
