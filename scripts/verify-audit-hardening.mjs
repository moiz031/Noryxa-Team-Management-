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
  console.log("=== Starting Batch 19: Global Audit Log Hardening Verification ===\n");

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

  // 1. Insert audit log entry with forensic fields
  let testLogId = null;
  const { data: inserted, error: insertErr } = await serviceClient
    .from("activity_logs")
    .insert({
      actor_id: adminId,
      action_type: "employee.suspended",
      entity_type: "employee",
      metadata: { reason: "Security audit compliance check" },
      source: "api",
      org_context: { verification: true },
    })
    .select("id, action_type, source, org_context")
    .single();

  if (insertErr || !inserted) {
    record("1. Forensic Audit Insert", "FAIL", `Insert failed: ${insertErr?.message}`);
  } else {
    testLogId = inserted.id;
    record("1. Forensic Audit Insert", "PASS", `Created log with source=${inserted.source}, action=${inserted.action_type}`);
  }

  // 2. Test immutability: UPDATE attempt must fail
  if (testLogId) {
    const { error: updateErr } = await serviceClient
      .from("activity_logs")
      .update({ action_type: "tampered.action" })
      .eq("id", testLogId);

    if (updateErr && /immutable|cannot be updated or deleted/i.test(updateErr.message)) {
      record("2. Immutability (UPDATE Blocked)", "PASS", `Trigger successfully blocked UPDATE: ${updateErr.message}`);
    } else {
      record("2. Immutability (UPDATE Blocked)", "FAIL", `UPDATE unexpectedly succeeded or returned wrong error: ${updateErr?.message}`);
    }

    // 3. Test immutability: DELETE attempt must fail
    const { error: deleteErr } = await serviceClient
      .from("activity_logs")
      .delete()
      .eq("id", testLogId);

    if (deleteErr && /immutable|cannot be updated or deleted/i.test(deleteErr.message)) {
      record("3. Immutability (DELETE Blocked)", "PASS", `Trigger successfully blocked DELETE: ${deleteErr.message}`);
    } else {
      record("3. Immutability (DELETE Blocked)", "FAIL", `DELETE unexpectedly succeeded or returned wrong error: ${deleteErr?.message}`);
    }
  }

  // 4. Test RLS: Employee cannot read activity_logs
  const { data: empLogs, error: empLogErr } = await employeeAuthClient
    .from("activity_logs")
    .select("id");

  if (empLogErr || (empLogs && empLogs.length === 0)) {
    record("4. Employee RLS on activity_logs", "PASS", "Employee access blocked or returned 0 rows");
  } else {
    record("4. Employee RLS on activity_logs", "FAIL", `Employee unexpectedly read ${empLogs?.length} rows`);
  }

  // 5. Test RLS: Admin can read activity_logs
  const { data: adminLogs, error: adminLogErr } = await adminAuthClient
    .from("activity_logs")
    .select("id, action_type, source")
    .limit(5);

  if (adminLogErr) {
    record("5. Admin RLS on activity_logs", "FAIL", `Admin read failed: ${adminLogErr.message}`);
  } else {
    record("5. Admin RLS on activity_logs", "PASS", `Admin read ${adminLogs?.length} rows successfully`);
  }

  // 6. Test RLS: Employee cannot read activity_logs_archive
  const { data: empArchive, error: empArchiveErr } = await employeeAuthClient
    .from("activity_logs_archive")
    .select("id");

  if (empArchiveErr || (empArchive && empArchive.length === 0)) {
    record("6. Employee RLS on activity_logs_archive", "PASS", "Employee cannot access archive table");
  } else {
    record("6. Employee RLS on activity_logs_archive", "FAIL", `Employee read ${empArchive?.length} archive rows`);
  }

  // 7. Test Archival RPC permission guard
  const { error: empRpcErr } = await employeeAuthClient.rpc("archive_old_audit_logs", {
    p_days_retention: 90,
  });

  if (empRpcErr && /administrator/i.test(empRpcErr.message)) {
    record("7. Archival Procedure Permissions", "PASS", `Non-admin execution blocked: ${empRpcErr.message}`);
  } else {
    record("7. Archival Procedure Permissions", "FAIL", `Employee archival unexpected result: ${empRpcErr?.message}`);
  }

  // 8. Test Archival RPC admin guardrail (< 30 days must be rejected)
  const { error: adminGuardrailErr } = await adminAuthClient.rpc("archive_old_audit_logs", {
    p_days_retention: 10,
  });

  if (adminGuardrailErr && /at least 30 days/i.test(adminGuardrailErr.message)) {
    record("8. Archival Retention Guardrail", "PASS", `Guardrail rejected < 30 days: ${adminGuardrailErr.message}`);
  } else {
    record("8. Archival Retention Guardrail", "FAIL", `Guardrail did not reject < 30 days: ${adminGuardrailErr?.message}`);
  }

  console.log("\n=== Summary ===");
  const allPass = results.every((r) => r.status === "PASS");
  console.log(`Total: ${results.length} | Passed: ${results.filter(r => r.status === "PASS").length} | Failed: ${results.filter(r => r.status === "FAIL").length}`);

  if (!allPass) {
    console.error("\nSome Batch 19 verification checks failed.");
    process.exit(1);
  } else {
    console.log("\nAll Batch 19 verification checks passed!");
  }
}

run().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
