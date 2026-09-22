import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";

/**
 * Server-only privileged client. Keep this module out of Client Components.
 * The service-role key bypasses RLS and is used only after a server-side admin check.
 */
export function createSupabaseAdminClient() {
  const env = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server");
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
