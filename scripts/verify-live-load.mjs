import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.VERIFY_EMPLOYEE_EMAIL;
const password = process.env.VERIFY_EMPLOYEE_PASSWORD;

if (!url || !publishableKey || !email || !password) {
  throw new Error("Live load verification requires Supabase URL/key and employee verification credentials.");
}

const totalRequests = Number(process.env.LOAD_REQUESTS || 100);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);
const client = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const queries = [
  () => client.from("projects").select("id").limit(25),
  () => client.from("tasks").select("id,status").limit(25),
  () => client.from("daily_reports").select("id,status").limit(25),
  () => client.from("attendance").select("id,status").limit(25),
  () => client.from("leave_requests").select("id,status").limit(25),
  () => client.from("notifications").select("id,read_at").limit(25),
];

const percentile = (values, p) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
};

const auth = await client.auth.signInWithPassword({ email, password });
if (auth.error || !auth.data.user) throw new Error(`Employee sign-in failed: ${auth.error?.message || "missing user"}`);

// Warm the project gateway once so measurements represent application queries.
await queries[0]();

const durations = [];
const failures = [];
const started = performance.now();
let completed = 0;

while (completed < totalRequests) {
  const batchSize = Math.min(concurrency, totalRequests - completed);
  const batch = Array.from({ length: batchSize }, (_, offset) => {
    const query = queries[(completed + offset) % queries.length];
    const requestStarted = performance.now();
    return query().then(({ error }) => {
      durations.push(performance.now() - requestStarted);
      if (error) failures.push(error.message);
    });
  });
  await Promise.all(batch);
  completed += batchSize;
}

const elapsedMs = performance.now() - started;
const p50 = percentile(durations, 0.5);
const p95 = percentile(durations, 0.95);
const throughput = (totalRequests / elapsedMs) * 1000;

console.log("=== Live Read Load Verification ===");
console.log(JSON.stringify({
  requests: totalRequests,
  concurrency,
  failures: failures.length,
  elapsed_ms: Math.round(elapsedMs),
  p50_ms: Math.round(p50),
  p95_ms: Math.round(p95),
  requests_per_second: Number(throughput.toFixed(2)),
}, null, 2));

if (failures.length > 0) {
  console.error(`Load verification failed: ${failures.slice(0, 3).join(" | ")}`);
  process.exit(1);
}

console.log("[PASS] Authenticated read-load completed without query failures.");
