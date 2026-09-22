/**
 * jest.setup.ts
 *
 * Global setup / teardown for the integration test suite.
 * - beforeAll:  seeds deterministic dev/test fixtures (only when Supabase is reachable)
 * - afterAll:   removes all rows tagged with SEED_TAG so the test DB stays clean
 *
 * The seed is idempotent (upserts by id) so running it multiple times is safe.
 * When SUPABASE_SERVICE_ROLE_KEY is not set or the host is unreachable, all
 * lifecycle hooks are skipped gracefully (no error thrown).
 */
import { seed, cleanup } from "../scripts/seed-dev-data";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

async function isReachable(): Promise<boolean> {
  if (!supabaseUrl || !hasServiceKey) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(`${supabaseUrl}/rest/v1/`, { method: "HEAD", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

beforeAll(async () => {
  if (process.env.SKIP_LIVE_SEED !== "1" && await isReachable()) {
    await seed();
  }
});

afterAll(async () => {
  if (process.env.SKIP_LIVE_SEED !== "1" && await isReachable()) {
    await cleanup();
  }
});
