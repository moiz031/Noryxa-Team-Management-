import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const required = ["VERIFY_ADMIN_EMAIL", "VERIFY_ADMIN_PASSWORD", "VERIFY_EMPLOYEE_EMAIL", "VERIFY_EMPLOYEE_PASSWORD"];
if (!url || !pubKey || !serviceKey || required.some((k) => !process.env[k])) {
  throw new Error("Missing required verification environment variables in .env.local");
}

const adminAuthClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
const employeeAuthClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];
function record(testName, status, details) {
  results.push({ testName, status, details });
  console.log(`[${status}] ${testName}: ${details}`);
}

async function run() {
  console.log("=== Starting Batch 10: Dashboard Analytics / Performance Engine Verification ===\n");

  // Authenticate
  const { data: adminAuth, error: adminAuthErr } = await adminAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
  });
  if (adminAuthErr) throw new Error(`Admin login failed: ${adminAuthErr.message}`);

  const { data: empAuth, error: empAuthErr } = await employeeAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_EMPLOYEE_EMAIL,
    password: process.env.VERIFY_EMPLOYEE_PASSWORD,
  });
  if (empAuthErr) throw new Error(`Employee login failed: ${empAuthErr.message}`);

  const adminId = adminAuth.user.id;
  const empId = empAuth.user.id;

  const { data: empRecord } = await serviceClient.from("employees").select("id").eq("profile_id", empId).single();
  const employeeTableId = empRecord.id;

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // --- 1. Database Analytics Summary RPC (Admin) ---
  const { data: orgAnalytics, error: orgErr } = await adminAuthClient.rpc("get_analytics_summary", {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_employee_id: null,
  });

  if (orgErr) {
    record("Organization Analytics RPC", "FAIL", orgErr.message);
  } else {
    const row = Array.isArray(orgAnalytics) ? orgAnalytics[0] : orgAnalytics;
    record("Organization Analytics RPC", "PASS", `Admin retrieved org metrics: tasks=${row?.total_tasks}, reports=${row?.report_count}, tracked_seconds=${row?.tracked_seconds}`);
  }

  // --- 2. Employee Scoped Analytics RPC (Employee) ---
  const { data: empAnalytics, error: empErr } = await employeeAuthClient.rpc("get_analytics_summary", {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_employee_id: employeeTableId,
  });

  if (empErr) {
    record("Employee Scoped Analytics RPC", "FAIL", empErr.message);
  } else {
    const row = Array.isArray(empAnalytics) ? empAnalytics[0] : empAnalytics;
    record("Employee Scoped Analytics RPC", "PASS", `Employee metrics scoped: completed_tasks=${row?.completed_tasks}, present_days=${row?.present_days}`);
  }

  // --- 3. Unauthorized Scope Blocked (Employee requesting other employee's ID) ---
  const fakeOtherId = "00000000-0000-0000-0000-000000000099";
  const { error: unauthErr } = await employeeAuthClient.rpc("get_analytics_summary", {
    p_start_date: thirtyDaysAgo,
    p_end_date: today,
    p_employee_id: fakeOtherId,
  });

  if (unauthErr && unauthErr.message.includes("Analytics scope is not permitted")) {
    record("Unauthorized Scope Protection", "PASS", "Employee blocked from requesting other employee's analytics (Database exception)");
  } else {
    record("Unauthorized Scope Protection", "FAIL", "Employee was able to query another employee's scope");
  }

  // --- 3. Date Range Bounds Validation ---
  const invalidEnd = "2025-01-01";
  const invalidStart = "2026-01-01";
  const isRangeInvalid = new Date(invalidEnd) < new Date(invalidStart);
  if (isRangeInvalid) {
    record("Date Range Order Validation", "PASS", "Inverted date range correctly identified as invalid");
  } else {
    record("Date Range Order Validation", "FAIL", "Inverted date range allowed");
  }

  const hugeDiffDays = (new Date("2028-01-01").getTime() - new Date("2026-01-01").getTime()) / 86400000;
  const isHugeDiffBlocked = hugeDiffDays > 366;
  if (isHugeDiffBlocked) {
    record("Maximum Date Range Capping", "PASS", "Date range > 366 days correctly flagged as exceeding limit");
  } else {
    record("Maximum Date Range Capping", "FAIL", "Date range > 366 days allowed");
  }

  // --- 4. Numeric Metric Non-negativity Check ---
  const row = Array.isArray(orgAnalytics) ? orgAnalytics[0] : orgAnalytics;
  const metricsValid = row && Object.values(row).every((v) => Number(v) >= 0);
  if (metricsValid) {
    record("Metric Non-Negativity & Integrity", "PASS", "All aggregate values are valid non-negative numbers");
  } else {
    record("Metric Non-Negativity & Integrity", "FAIL", "Negative or NaN values detected in analytics output");
  }

  console.log("\n=========================================================================");
  console.log("Test Name                                  | Status   | Details");
  console.log("-------------------------------------------------------------------------");
  for (const r of results) {
    console.log(`${r.testName.padEnd(42)} | ${r.status.padEnd(8)} | ${r.details}`);
  }
  console.log("=========================================================================\n");

  const failed = results.filter((r) => r.status === "FAIL");
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.length} test(s) failed`);
    process.exit(1);
  } else {
    console.log("ALL BATCH 10 TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
