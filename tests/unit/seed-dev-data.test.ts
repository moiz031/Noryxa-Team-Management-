/**
 * tests/unit/seed-dev-data.test.ts
 *
 * Verifies that:
 *  1. seed() inserts deterministic rows without errors.
 *  2. Running seed() a second time does not throw (idempotent upserts).
 *  3. cleanup() removes all seeded rows tagged with SEED_TAG.
 *
 * This test requires a real Supabase connection (SUPABASE_SERVICE_ROLE_KEY must
 * be present) and a reachable Supabase host. It will be skipped automatically
 * in environments that do not expose the service key or cannot reach Supabase.
 */

import { seed, cleanup, SEED_IDS } from "../../scripts/seed-dev-data";
import { getServiceClient } from "../helpers/test-client";

const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Quick connectivity check: resolves true if the Supabase REST endpoint responds. */
async function canReachSupabase(): Promise<boolean> {
  if (!supabaseUrl) return false;
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

// Skip the entire suite if no service key or no network access to Supabase
const describeOrSkip = hasServiceKey ? describe : describe.skip;

describeOrSkip("Seed / Cleanup Round-trip", () => {
  let supabaseReachable = false;

  beforeAll(async () => {
    supabaseReachable = await canReachSupabase();
    if (!supabaseReachable) {
      console.warn("⚠  Supabase host unreachable – DB verification tests will be skipped.");
    }
  });

  /** Helper that skips the test when Supabase is not reachable. */
  function skipIfOffline(name: string, fn: () => Promise<void>) {
    it(name, async () => {
      if (!supabaseReachable) {
        console.log(`Skipping "${name}" (Supabase unreachable)`);
        return;
      }
      await fn();
    });
  }

  skipIfOffline("seed() runs without errors", async () => {
    await expect(seed()).resolves.not.toThrow();
  });

  skipIfOffline("seed() is idempotent – second call does not throw", async () => {
    await expect(seed()).resolves.not.toThrow();
  });

  skipIfOffline("seeded profile row exists in DB after seed()", async () => {
    const db = getServiceClient();
    const email = process.env.VERIFY_ADMIN_EMAIL;
    const { data, error } = await db
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .single();

    expect(error).toBeNull();
    expect(data?.email).toBe(email);
  });

  skipIfOffline("seeded task row exists in DB after seed()", async () => {
    const db = getServiceClient();
    const { data, error } = await db
      .from("tasks")
      .select("id, seed_tag")
      .eq("id", SEED_IDS.task)
      .single();

    expect(error).toBeNull();
    expect(data?.seed_tag).toBe("dev_seed");
  });

  skipIfOffline("cleanup() removes all seeded rows", async () => {
    await expect(cleanup()).resolves.not.toThrow();

    const db = getServiceClient();
    const { data: tasks } = await db
      .from("tasks")
      .select("id")
      .eq("seed_tag", "dev_seed");

    expect(tasks?.length ?? 0).toBe(0);
  });

  // Re-seed after cleanup so other tests in the suite are not affected
  afterAll(async () => {
    if (supabaseReachable) {
      await seed();
    }
  });
});
