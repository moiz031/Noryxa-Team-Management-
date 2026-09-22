import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type TestContext = {
  adminClient: SupabaseClient;
  employeeClient: SupabaseClient;
  serviceClient: SupabaseClient;
  adminId: string;
  employeeId: string;
  employeeProfileId: string;
};

let cachedContext: TestContext | null = null;
let _reachableCache: boolean | null = null;

export function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase URL or SERVICE_ROLE_KEY in environment");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Returns true if the Supabase REST endpoint is reachable from this environment. */
export async function isSupabaseReachable(): Promise<boolean> {
  if (_reachableCache !== null) return _reachableCache;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    _reachableCache = false;
    return false;
  }
  const controller = new AbortController();
  // Supabase's first request after a paused project resumes can take a few
  // seconds while the gateway warms up. Keep the probe bounded, but avoid
  // classifying a healthy live project as offline during that window.
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    await fetch(`${url}/rest/v1/`, { method: "HEAD", signal: controller.signal });
    _reachableCache = true;
  } catch {
    _reachableCache = false;
  } finally {
    clearTimeout(timer);
  }
  return _reachableCache;
}

/**
 * Executes a test only when Supabase is reachable; skips gracefully in offline environments.
 */
export function itDb(name: string, fn: () => Promise<void> | void): void {
  it(name, async () => {
    if (!(await isSupabaseReachable())) {
      if (process.env.REQUIRE_LIVE_TESTS === "1") {
        throw new Error(`Live Supabase is required for integration test: ${name}`);
      }
      console.log(`Skipping "${name}" (Supabase unreachable)`);
      return;
    }
    await fn();
  });
}

export async function getTestContext(): Promise<TestContext> {
  if (cachedContext) return cachedContext;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !pubKey || !serviceKey) {
    throw new Error("Missing Supabase environment variables in .env.local");
  }

  const adminEmail = process.env.VERIFY_ADMIN_EMAIL || "verify.admin@agency-os.internal";
  const adminPassword = process.env.VERIFY_ADMIN_PASSWORD || "VerifyAdminPassword#2026";
  const employeeEmail = process.env.VERIFY_EMPLOYEE_EMAIL || "verify.employee@agency-os.internal";
  const employeePassword = process.env.VERIFY_EMPLOYEE_PASSWORD || "VerifyEmployeePassword#2026";

  const adminClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const employeeClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // The live runner provisions its verification accounts separately. Avoid
  // running the legacy development fixture seed here because it uses fixed
  // profile IDs that are not the authenticated live users.

  const [adminAuth, employeeAuth] = await Promise.all([
    adminClient.auth.signInWithPassword({ email: adminEmail, password: adminPassword }),
    employeeClient.auth.signInWithPassword({ email: employeeEmail, password: employeePassword }),
  ]);

  if (adminAuth.error || !adminAuth.data.user) {
    throw new Error(`Failed to sign in verify admin: ${adminAuth.error?.message}`);
  }
  if (employeeAuth.error || !employeeAuth.data.user) {
    throw new Error(`Failed to sign in verify employee: ${employeeAuth.error?.message}`);
  }

  const { data: empRecord } = await serviceClient
    .from("employees")
    .select("id")
    .eq("profile_id", employeeAuth.data.user.id)
    .single();

  cachedContext = {
    adminClient,
    employeeClient,
    serviceClient,
    adminId: adminAuth.data.user.id,
    employeeId: empRecord?.id || "",
    employeeProfileId: employeeAuth.data.user.id,
  };

  return cachedContext;
}

export function generateTestId(prefix = "test"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}
