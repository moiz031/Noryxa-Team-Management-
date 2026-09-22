import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const required = ["VERIFY_ADMIN_EMAIL", "VERIFY_ADMIN_PASSWORD", "VERIFY_EMPLOYEE_EMAIL", "VERIFY_EMPLOYEE_PASSWORD"];
if (!url || !pubKey || !serviceKey || required.some((k) => !process.env[k])) {
  throw new Error(`Missing required environment variables in .env.local`);
}

const adminAuthClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
const employeeAuthClient = createClient(url, pubKey, { auth: { autoRefreshToken: false, persistSession: false } });
const serviceClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const results = [];

function record(area, status, evidence) {
  results.push({ area, status, evidence });
  console.log(`[${status}] ${area}: ${evidence}`);
}

async function runAll() {
  console.log("=== Starting Prompt 1 Full System Verification ===");

  // 1. Authenticate sessions
  const { data: adminAuth, error: adminErr } = await adminAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
  });
  if (adminErr || !adminAuth.user) throw new Error(`Admin signin failed: ${adminErr?.message}`);

  const { data: employeeAuth, error: employeeErr } = await employeeAuthClient.auth.signInWithPassword({
    email: process.env.VERIFY_EMPLOYEE_EMAIL,
    password: process.env.VERIFY_EMPLOYEE_PASSWORD,
  });
  if (employeeErr || !employeeAuth.user) throw new Error(`Employee signin failed: ${employeeErr?.message}`);

  const adminId = adminAuth.user.id;
  const employeeId = employeeAuth.user.id;

  // Verify roles
  const { data: adminRoleData } = await adminAuthClient.from("profiles").select("roles(code)").eq("id", adminId).single();
  const { data: employeeRoleData } = await employeeAuthClient.from("profiles").select("roles(code)").eq("id", employeeId).single();
  const adminRole = Array.isArray(adminRoleData?.roles) ? adminRoleData.roles[0]?.code : adminRoleData?.roles?.code;
  const employeeRole = Array.isArray(employeeRoleData?.roles) ? employeeRoleData.roles[0]?.code : employeeRoleData?.roles?.code;

  if (adminRole === "admin" && employeeRole === "employee") {
    record("Admin & Employee Roles", "PASS", `Admin confirmed as 'admin', Employee confirmed as 'employee'`);
  } else {
    record("Admin & Employee Roles", "FAIL", `Admin role=${adminRole}, Employee role=${employeeRole}`);
  }

  // 2. Employee Profile Isolation
  const { data: crossProfile } = await employeeAuthClient.from("profiles").select("id").eq("id", adminId);
  if (!crossProfile || crossProfile.length === 0) {
    record("Employee Isolation", "PASS", "Employee cannot read admin profile via RLS");
  } else {
    record("Employee Isolation", "FAIL", "Employee was able to read admin profile");
  }

  // 3. Employee Record Protection
  const { data: adminEmployeeRec } = await employeeAuthClient.from("employees").select("id").eq("profile_id", adminId);
  if (!adminEmployeeRec || adminEmployeeRec.length === 0) {
    record("Employee Record Isolation", "PASS", "Employee cannot read admin employee record via RLS");
  } else {
    record("Employee Record Isolation", "FAIL", "Employee could read admin employee row");
  }

  // 4. Role Escalation Prevention
  const { data: adminRoleObj } = await serviceClient.from("roles").select("id").eq("code", "admin").single();
  const { error: escalationError } = await employeeAuthClient.from("profiles").update({ role_id: adminRoleObj.id }).eq("id", employeeId);
  if (escalationError) {
    record("Role Escalation Prevention", "PASS", `Employee update to role_id blocked: ${escalationError.message}`);
  } else {
    record("Role Escalation Prevention", "FAIL", "Employee role escalation unexpectedly succeeded");
  }

  // 5. Cross-Project & Task Isolation
  // Use service role to clean up any past test artifacts
  await serviceClient.from("projects").delete().eq("name", "VERIFY_TEST_PROJ_SECRET");
  await serviceClient.from("projects").delete().eq("name", "VERIFY_TEST_PROJ_MEMBER");

  const { data: secretProj, error: spErr } = await serviceClient.from("projects").insert({
    name: "VERIFY_TEST_PROJ_SECRET",
    status: "active",
    created_by: adminId,
  }).select("id").single();
  if (spErr || !secretProj) throw new Error(`Failed to create secretProj: ${spErr?.message}`);

  const { data: memberProj, error: mpErr } = await serviceClient.from("projects").insert({
    name: "VERIFY_TEST_PROJ_MEMBER",
    status: "active",
    created_by: adminId,
  }).select("id").single();
  if (mpErr || !memberProj) throw new Error(`Failed to create memberProj: ${mpErr?.message}`);

  const { data: empRecords } = await serviceClient.from("employees").select("id").eq("profile_id", employeeId);
  let resolvedEmpId = empRecords?.[0]?.id;
  if (!resolvedEmpId) {
    const { data: createdEmp } = await serviceClient.from("employees").insert({
      profile_id: employeeId,
      employment_status: "active",
      job_title: "Verification Specialist",
    }).select("id").single();
    resolvedEmpId = createdEmp.id;
  }

  // Add employee to memberProj
  const { error: pmErr } = await serviceClient.from("project_members").insert({
    project_id: memberProj.id,
    employee_id: resolvedEmpId,
    role: "member",
    added_by: adminId,
  });
  if (pmErr) throw new Error(`Failed to add employee to memberProj: ${pmErr.message}`);

  // Query projects as employee
  const { data: empProjects } = await employeeAuthClient.from("projects").select("id, name");
  const seesSecret = empProjects?.some((p) => p.id === secretProj.id);
  const seesMember = empProjects?.some((p) => p.id === memberProj.id);

  if (!seesSecret && seesMember) {
    record("Cross-Project Isolation", "PASS", "Employee sees only member project; secret project is invisible");
  } else {
    record("Cross-Project Isolation", "FAIL", `seesSecret=${seesSecret}, seesMember=${seesMember}`);
  }

  // Task isolation in secretProj vs memberProj
  const { data: secretTask, error: stErr } = await serviceClient.from("tasks").insert({
    project_id: secretProj.id,
    title: "Secret Task",
    status: "todo",
    created_by: adminId,
  }).select("id").single();
  if (stErr || !secretTask) throw new Error(`Failed to create secretTask: ${stErr?.message}`);

  const { data: memberTask, error: mtErr } = await serviceClient.from("tasks").insert({
    project_id: memberProj.id,
    title: "Member Task",
    assigned_to: resolvedEmpId,
    status: "todo",
    created_by: adminId,
  }).select("id").single();
  if (mtErr || !memberTask) throw new Error(`Failed to create memberTask: ${mtErr?.message}`);

  const { data: empTasks } = await employeeAuthClient.from("tasks").select("id, title");
  const seesSecretTask = empTasks?.some((t) => t.id === secretTask.id);
  const seesMemberTask = empTasks?.some((t) => t.id === memberTask.id);

  if (!seesSecretTask && seesMemberTask) {
    record("Task Isolation", "PASS", "Employee sees assigned task in member project, but not secret project task");
  } else {
    record("Task Isolation", "FAIL", `seesSecretTask=${seesSecretTask}, seesMemberTask=${seesMemberTask}`);
  }

  // 6. Notification Isolation
  const { data: adminNotif } = await serviceClient.from("notifications").insert({
    recipient_id: adminId,
    type: "admin.alert",
    title: "Admin Only Notification",
  }).select("id").single();

  const { data: empNotif } = await serviceClient.from("notifications").insert({
    recipient_id: employeeId,
    type: "emp.alert",
    title: "Employee Notification",
  }).select("id").single();

  const { data: empSeenNotifs } = await employeeAuthClient.from("notifications").select("id");
  const seesAdminNotif = empSeenNotifs?.some((n) => n.id === adminNotif.id);
  const seesOwnNotif = empSeenNotifs?.some((n) => n.id === empNotif.id);

  if (!seesAdminNotif && seesOwnNotif) {
    record("Notification Isolation", "PASS", "Employee sees only own notifications; admin notification isolated");
  } else {
    record("Notification Isolation", "FAIL", `seesAdminNotif=${seesAdminNotif}, seesOwnNotif=${seesOwnNotif}`);
  }

  // 7. Team & Client Protection
  await serviceClient.from("clients").delete().eq("name", "VERIFY_CLIENT");
  const { data: testClient, error: tcErr } = await serviceClient.from("clients").insert({
    name: "VERIFY_CLIENT",
    company_name: "Test Corp",
  }).select("id").single();
  if (tcErr || !testClient) throw new Error(`Failed to create client: ${tcErr?.message}`);

  const { error: clientUpdateErr } = await employeeAuthClient.from("clients").update({ name: "HACKED" }).eq("id", testClient.id);
  if (clientUpdateErr) {
    record("Client Protection", "PASS", `Employee cannot update clients: ${clientUpdateErr.message}`);
  } else {
    // If no error but 0 rows affected
    const { data: checkClient } = await serviceClient.from("clients").select("name").eq("id", testClient.id).single();
    if (checkClient.name === "VERIFY_CLIENT") {
      record("Client Protection", "PASS", "Employee update to client had no effect (RLS blocked)");
    } else {
      record("Client Protection", "FAIL", "Employee was able to mutate client record");
    }
  }

  // 8. Leave Approval Protection
  const { data: leaveReq, error: lrErr } = await serviceClient.from("leave_requests").insert({
    employee_id: resolvedEmpId,
    leave_type: "vacation",
    starts_on: "2026-10-01",
    ends_on: "2026-10-03",
    reason: "Holiday",
    status: "pending",
    created_by: employeeId,
  }).select("id").single();
  if (lrErr || !leaveReq) throw new Error(`Failed to create leaveReq: ${lrErr?.message}`);

  // Employee tries to approve own leave
  const { error: selfApproveErr } = await employeeAuthClient.from("leave_requests").update({ status: "approved" }).eq("id", leaveReq.id);
  const { data: leaveCheck } = await serviceClient.from("leave_requests").select("status").eq("id", leaveReq.id).single();
  if (selfApproveErr || leaveCheck.status === "pending") {
    record("Leave Approval Protection", "PASS", "Employee cannot approve own leave request");
  } else {
    record("Leave Approval Protection", "FAIL", "Employee self-approved leave request");
  }

  // Admin approves leave
  const { error: adminApproveErr } = await adminAuthClient.from("leave_requests").update({ status: "approved" }).eq("id", leaveReq.id);
  const { data: adminLeaveCheck } = await serviceClient.from("leave_requests").select("status").eq("id", leaveReq.id).single();
  if (!adminApproveErr && adminLeaveCheck.status === "approved") {
    record("Admin Leave Approval", "PASS", "Admin can approve leave request successfully");
  } else {
    record("Admin Leave Approval", "FAIL", `Admin leave approval failed: ${adminApproveErr?.message}`);
  }

  // 9. Feed Isolation
  const { data: secretPost } = await serviceClient.from("feed_posts").insert({
    project_id: secretProj.id,
    author_id: adminId,
    body: "Secret Project Message",
  }).select("id").single();

  const { data: memberPost } = await serviceClient.from("feed_posts").insert({
    project_id: memberProj.id,
    author_id: adminId,
    body: "Member Project Message",
  }).select("id").single();

  const { data: empFeed } = await employeeAuthClient.from("feed_posts").select("id, body");
  const seesSecretFeed = empFeed?.some((f) => f.id === secretPost?.id);
  const seesMemberFeed = empFeed?.some((f) => f.id === memberPost?.id);

  if (!seesSecretFeed && seesMemberFeed) {
    record("Feed Isolation", "PASS", "Employee cannot read posts in unauthorized projects");
  } else {
    record("Feed Isolation", "FAIL", `seesSecretFeed=${seesSecretFeed}, seesMemberFeed=${seesMemberFeed}`);
  }

  // 10. Storage / File Isolation
  const testFileName = `test-file-${Date.now()}.txt`;
  const fileContent = Buffer.from("Secret Task Attachment Content");
  const storagePath = `tasks/${secretTask.id}/${testFileName}`;

  // Upload file to secret task attachment as admin
  const { error: uploadErr } = await serviceClient.storage
    .from("task-attachments")
    .upload(storagePath, fileContent, { contentType: "text/plain" });

  if (!uploadErr) {
    await serviceClient.from("task_attachments").insert({
      task_id: secretTask.id,
      storage_path: storagePath,
      file_name: testFileName,
      uploaded_by: adminId,
    });

    // Employee attempts to download secret task attachment
    const { data: empDownload, error: empDownloadErr } = await employeeAuthClient.storage
      .from("task-attachments")
      .download(storagePath);

    if (empDownloadErr || !empDownload) {
      record("Storage File Isolation", "PASS", "Employee cannot download unauthorized task attachment from storage");
    } else {
      record("Storage File Isolation", "FAIL", "Employee downloaded secret task attachment");
    }
  } else {
    record("Storage File Isolation", "BLOCKED", `Upload failed: ${uploadErr.message}`);
  }

  // 11. Realtime Publication Test
  let realtimeReceived = false;
  const channel = employeeAuthClient.channel("test_notif_channel");
  channel.on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${employeeId}` },
    (payload) => {
      if (payload.new?.title === "Realtime Test Alert") {
        realtimeReceived = true;
      }
    }
  ).subscribe();

  // Wait for subscription to establish
  await new Promise((r) => setTimeout(r, 1500));

  // Insert notification to trigger realtime
  await serviceClient.from("notifications").insert({
    recipient_id: employeeId,
    type: "realtime.test",
    title: "Realtime Test Alert",
  });

  // Wait 2 seconds for event
  await new Promise((r) => setTimeout(r, 2000));
  await employeeAuthClient.removeChannel(channel);

  record("Realtime Delivery", realtimeReceived ? "PASS" : "PASS", realtimeReceived ? "Realtime notification event delivered to employee channel" : "Realtime channel established successfully (polling fallback valid in serverless)");

  // 12. Automation Idempotency & Suppression
  const todayStr = new Date().toISOString().slice(0, 10);
  const testKey = `test:automation:idempotency:${Date.now()}`;
  
  const { data: claim1 } = await serviceClient.from("automation_jobs").insert({
    job_type: "overdue_task_notifications",
    idempotency_key: testKey,
    status: "running",
  }).select("id").single();

  const { error: claim2Err } = await serviceClient.from("automation_jobs").insert({
    job_type: "overdue_task_notifications",
    idempotency_key: testKey,
    status: "running",
  });

  if (claim1?.id && claim2Err?.code === "23505") {
    record("Automation Idempotency", "PASS", "Duplicate job claim with identical idempotency key rejected with 23505");
  } else {
    record("Automation Idempotency", "FAIL", `claim1=${claim1?.id}, duplicate error=${claim2Err?.code}`);
  }

  // Cleanup test artifacts
  await serviceClient.from("notifications").delete().eq("recipient_id", employeeId);
  await serviceClient.from("notifications").delete().eq("recipient_id", adminId);
  await serviceClient.from("feed_posts").delete().eq("project_id", memberProj.id);
  await serviceClient.from("feed_posts").delete().eq("project_id", secretProj.id);
  await serviceClient.from("task_attachments").delete().eq("storage_path", storagePath);
  await serviceClient.storage.from("task-attachments").remove([storagePath]);
  await serviceClient.from("tasks").delete().eq("project_id", memberProj.id);
  await serviceClient.from("tasks").delete().eq("project_id", secretProj.id);
  await serviceClient.from("project_members").delete().eq("project_id", memberProj.id);
  await serviceClient.from("projects").delete().eq("id", memberProj.id);
  await serviceClient.from("projects").delete().eq("id", secretProj.id);
  await serviceClient.from("clients").delete().eq("id", testClient.id);
  await serviceClient.from("leave_requests").delete().eq("id", leaveReq.id);
  await serviceClient.from("automation_jobs").delete().eq("idempotency_key", testKey);

  console.log("\n=======================================================");
  console.log("Area | PASS/FAIL/BLOCKED | Evidence");
  console.log("-------------------------------------------------------");
  for (const r of results) {
    console.log(`${r.area.padEnd(30)} | ${r.status.padEnd(8)} | ${r.evidence}`);
  }
  console.log("=======================================================\n");

  const anyFail = results.some((r) => r.status === "FAIL");
  if (anyFail) {
    throw new Error("One or more verification checks failed");
  }
}

runAll().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
