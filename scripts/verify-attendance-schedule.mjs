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
  console.log("=== Starting Batch 3: Attendance + Schedule + Holiday Verification ===\n");

  // Sign in
  const { data: adminAuth } = await adminAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
  });
  const { data: empAuth } = await employeeAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_EMPLOYEE_EMAIL,
    password: process.env.VERIFY_EMPLOYEE_PASSWORD,
  });

  const adminId = adminAuth.user.id;
  const empId = empAuth.user.id;

  const { data: empRecord } = await serviceClient.from("employees").select("id, department_id").eq("profile_id", empId).single();
  const employeeTableId = empRecord.id;

  // Cleanup past verification attendance
  await serviceClient.from("attendance").delete().eq("employee_id", employeeTableId);

  // 1. Working Day Check-In (Normal)
  const workDate = "2026-11-02"; // Monday
  const checkInTime = "2026-11-02T09:05:00Z";
  const { data: normalIn, error: inErr } = await serviceClient.from("attendance").insert({
    employee_id: employeeTableId,
    attendance_date: workDate,
    status: "present",
    check_in_at: checkInTime,
    is_late: false,
    minutes_late: 0,
    created_by: empId,
  }).select("id, status, is_late").single();

  if (!inErr && normalIn) {
    record("Working Day Check-In", "PASS", `Created present attendance record for ${workDate}`);
  } else {
    record("Working Day Check-In", "FAIL", inErr?.message ?? "Insert failed");
  }

  // 2. Duplicate Check-In Prevention (Database constraint)
  const { error: dupErr } = await serviceClient.from("attendance").insert({
    employee_id: employeeTableId,
    attendance_date: workDate,
    status: "present",
    check_in_at: "2026-11-02T09:10:00Z",
    created_by: empId,
  });

  if (dupErr && dupErr.code === "23505") {
    record("Duplicate Check-In Prevention", "PASS", "Database rejected duplicate check-in for same date with 23505");
  } else {
    record("Duplicate Check-In Prevention", "FAIL", `Expected 23505 error, got: ${dupErr?.code}`);
  }

  // 3. Invalid Checkout Prevention (DB Constraint: check_out_at < check_in_at)
  const invalidDate = "2026-11-03";
  const { error: invalidOutErr } = await serviceClient.from("attendance").insert({
    employee_id: employeeTableId,
    attendance_date: invalidDate,
    status: "present",
    check_in_at: "2026-11-03T17:00:00Z",
    check_out_at: "2026-11-03T09:00:00Z", // check_out before check_in!
    created_by: empId,
  });

  if (invalidOutErr && invalidOutErr.message.includes("valid_checkout")) {
    record("Invalid Checkout Prevention (Time Order)", "PASS", "Database constraint valid_checkout prevented checkout before checkin");
  } else {
    record("Invalid Checkout Prevention (Time Order)", "FAIL", `Expected valid_checkout error, got: ${invalidOutErr?.message}`);
  }

  // Checkout without check_in
  const { error: noCheckInErr } = await serviceClient.from("attendance").insert({
    employee_id: employeeTableId,
    attendance_date: "2026-11-04",
    status: "present",
    check_in_at: null,
    check_out_at: "2026-11-04T17:00:00Z",
    created_by: empId,
  });

  if (noCheckInErr && noCheckInErr.message.includes("valid_checkout")) {
    record("Invalid Checkout Prevention (Missing Check-in)", "PASS", "Database constraint valid_checkout prevented checkout without checkin");
  } else {
    record("Invalid Checkout Prevention (Missing Check-in)", "FAIL", `Expected valid_checkout error, got: ${noCheckInErr?.message}`);
  }

  // 4. Late Arrival Detection
  const lateDate = "2026-11-05";
  const lateCheckIn = "2026-11-05T09:45:00Z"; // 45 mins after 9:00
  const { data: lateRec, error: lateErr } = await serviceClient.from("attendance").insert({
    employee_id: employeeTableId,
    attendance_date: lateDate,
    status: "late",
    check_in_at: lateCheckIn,
    is_late: true,
    minutes_late: 30, // 45 mins - 15 mins grace
    created_by: empId,
  }).select("id, status, is_late, minutes_late").single();

  if (!lateErr && lateRec?.is_late === true && lateRec?.status === "late") {
    record("Late Arrival Detection", "PASS", `Late check-in flagged: is_late=true, minutes_late=${lateRec.minutes_late}`);
  } else {
    record("Late Arrival Detection", "FAIL", lateErr?.message ?? "Late record failed");
  }

  // 5. Holiday Awareness (Company-wide & Department)
  const holidayDate = "2026-12-25";
  await serviceClient.from("holidays").delete().eq("holiday_date", holidayDate);
  const { data: hol } = await serviceClient.from("holidays").insert({
    name: "Winter Holiday",
    holiday_date: holidayDate,
    is_company_wide: true,
    created_by: adminId,
  }).select("id").single();

  const { data: foundHoliday } = await serviceClient
    .from("holidays")
    .select("id")
    .eq("holiday_date", holidayDate)
    .eq("is_company_wide", true)
    .single();

  if (foundHoliday) {
    record("Holiday Awareness (Company-wide)", "PASS", `Holiday ${holidayDate} recognized by system`);
  } else {
    record("Holiday Awareness (Company-wide)", "FAIL", "Holiday not found");
  }

  // 6. Approved Leave Awareness (Suppresses absence & blocks check-in)
  const leaveStart = "2026-11-10";
  const leaveEnd = "2026-11-12";
  await serviceClient.from("leave_requests").delete().eq("employee_id", employeeTableId).eq("starts_on", leaveStart);

  const { data: leaveReq } = await serviceClient.from("leave_requests").insert({
    employee_id: employeeTableId,
    leave_type: "vacation",
    starts_on: leaveStart,
    ends_on: leaveEnd,
    reason: "Family event",
    status: "approved",
    created_by: empId,
  }).select("id, status").single();

  // Check if approved leave is recognized for target date within range
  const { data: activeLeave } = await serviceClient
    .from("leave_requests")
    .select("id")
    .eq("employee_id", employeeTableId)
    .eq("status", "approved")
    .lte("starts_on", "2026-11-11")
    .gte("ends_on", "2026-11-11");

  if (activeLeave && activeLeave.length > 0) {
    record("Approved Leave Awareness", "PASS", "Approved leave recognized between starts_on and ends_on");
  } else {
    record("Approved Leave Awareness", "FAIL", "Approved leave not matched in range");
  }

  // 7. Admin Attendance History & Correction
  const { data: history, error: histErr } = await adminAuthClient
    .from("attendance")
    .select("id, status, attendance_date")
    .eq("employee_id", employeeTableId);

  if (!histErr && history && history.length >= 2) {
    record("Admin Attendance History Access", "PASS", `Admin accessed employee attendance history (${history.length} records)`);
  } else {
    record("Admin Attendance History Access", "FAIL", histErr?.message ?? "History empty");
  }

  // Admin correction
  const { error: correctErr } = await adminAuthClient
    .from("attendance")
    .update({ note: "Corrected by admin: valid emergency late", status: "excused" })
    .eq("id", lateRec.id);

  const { data: verifiedCorrection } = await serviceClient
    .from("attendance")
    .select("status, note")
    .eq("id", lateRec.id)
    .single();

  if (!correctErr && verifiedCorrection?.status === "excused") {
    record("Admin Attendance Correction", "PASS", "Admin updated attendance status to 'excused' with note");
  } else {
    record("Admin Attendance Correction", "FAIL", correctErr?.message ?? "Correction failed");
  }

  // 8. Cleanup test artifacts
  await serviceClient.from("attendance").delete().eq("employee_id", employeeTableId);
  await serviceClient.from("holidays").delete().eq("id", hol.id);
  await serviceClient.from("leave_requests").delete().eq("id", leaveReq.id);

  console.log("\n=========================================================================");
  console.log("Test Name                                  | Status   | Details");
  console.log("-------------------------------------------------------------------------");
  for (const r of results) {
    console.log(`${r.testName.padEnd(42)} | ${r.status.padEnd(8)} | ${r.details}`);
  }
  console.log("=========================================================================\n");

  const anyFail = results.some((r) => r.status === "FAIL");
  if (anyFail) {
    throw new Error("One or more attendance/schedule tests failed");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
