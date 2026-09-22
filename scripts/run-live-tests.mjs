import { spawn } from "node:child_process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Live integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

let timeout;
try {
  const controller = new AbortController();
  timeout = setTimeout(() => controller.abort(), 10_000);
  const response = await fetch(`${url}/rest/v1/`, { method: "HEAD", signal: controller.signal });
  clearTimeout(timeout);
  if (!response.ok && response.status !== 401) {
    throw new Error(`Supabase returned HTTP ${response.status}`);
  }
} catch (error) {
  clearTimeout(timeout);
  console.error(`Supabase is not reachable: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["node_modules/jest/bin/jest.js", "--runInBand", "tests/integration"],
  {
    stdio: "inherit",
    // Live integration tests use the configured verification accounts and
    // should not run the legacy development fixture seed on every test file.
    env: { ...process.env, REQUIRE_LIVE_TESTS: "1", SKIP_LIVE_SEED: "1" },
  },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
