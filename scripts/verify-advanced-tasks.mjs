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
  console.log("=== Starting Batch 4: Advanced Task System Final Audit ===\n");

  // Authenticate
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

  const { data: empRecord } = await serviceClient.from("employees").select("id").eq("profile_id", empId).single();
  const employeeTableId = empRecord.id;

  // Project setup
  const { data: testProj } = await serviceClient.from("projects").insert({
    name: `TASK_AUDIT_PROJ_${Date.now()}`,
    status: "active",
    created_by: adminId,
  }).select("id").single();

  await serviceClient.from("project_members").insert({
    project_id: testProj.id,
    employee_id: employeeTableId,
    role: "member",
    added_by: adminId,
  });

  // 1. Circular Subtask Hierarchy Prevention
  const { data: taskA } = await serviceClient.from("tasks").insert({
    project_id: testProj.id,
    title: "Parent Task A",
    status: "todo",
    created_by: adminId,
  }).select("id").single();

  const { data: taskB } = await serviceClient.from("tasks").insert({
    project_id: testProj.id,
    title: "Subtask B",
    status: "todo",
    parent_task_id: taskA.id,
    created_by: adminId,
  }).select("id").single();

  // Attempt to make Task A a child of Task B (creates cycle A -> B -> A)
  const { error: hierarchyCycleErr } = await serviceClient.from("tasks").update({
    parent_task_id: taskB.id,
  }).eq("id", taskA.id);

  if (hierarchyCycleErr && hierarchyCycleErr.message.includes("hierarchy cycle is not allowed")) {
    record("Circular Subtasks Prevention", "PASS", "Trigger prevented circular parent_task_id assignment");
  } else {
    record("Circular Subtasks Prevention", "FAIL", `Expected cycle error, got: ${hierarchyCycleErr?.message}`);
  }

  // 2. Circular Dependency Prevention
  const { data: task1 } = await serviceClient.from("tasks").insert({
    project_id: testProj.id,
    title: "Dependency Task 1",
    status: "todo",
    created_by: adminId,
  }).select("id").single();

  const { data: task2 } = await serviceClient.from("tasks").insert({
    project_id: testProj.id,
    title: "Dependency Task 2",
    status: "todo",
    created_by: adminId,
  }).select("id").single();

  // Task 2 depends on Task 1
  const { error: dep1Err } = await serviceClient.from("task_dependencies").insert({
    task_id: task2.id,
    depends_on_task_id: task1.id,
    created_by: adminId,
  });
  if (dep1Err) throw new Error(`Initial dependency failed: ${dep1Err.message}`);

  // Attempt to make Task 1 depend on Task 2 (creates cycle 1 -> 2 -> 1)
  const { error: depCycleErr } = await serviceClient.from("task_dependencies").insert({
    task_id: task1.id,
    depends_on_task_id: task2.id,
    created_by: adminId,
  });

  if (depCycleErr && depCycleErr.message.includes("dependency cycle is not allowed")) {
    record("Circular Task Dependency Prevention", "PASS", "Trigger prevented circular dependency 1 -> 2 -> 1");
  } else {
    record("Circular Task Dependency Prevention", "FAIL", `Expected cycle error, got: ${depCycleErr?.message}`);
  }

  // 3. Invalid Dependency Transition Prevention
  // Task 1 is currently 'todo' (not completed). Task 2 depends on Task 1.
  // Attempt to transition Task 2 to 'in_progress' or 'completed'
  const { error: invalidTransErr } = await serviceClient.from("tasks").update({
    status: "in_progress",
  }).eq("id", task2.id);

  if (invalidTransErr && invalidTransErr.message.includes("Not all dependencies are completed")) {
    record("Invalid Dependency Transition Blocked", "PASS", "Task cannot start/complete while blocking dependency is incomplete");
  } else {
    record("Invalid Dependency Transition Blocked", "FAIL", `Expected transition block, got: ${invalidTransErr?.message}`);
  }

  // Complete Task 1, then transition Task 2
  await serviceClient.from("tasks").update({ status: "completed" }).eq("id", task1.id);
  const { data: completedTrans, error: validTransErr } = await serviceClient.from("tasks").update({
    status: "in_progress",
  }).eq("id", task2.id).select("status").single();

  if (!validTransErr && completedTrans?.status === "in_progress") {
    record("Valid Dependency Transition Allowed", "PASS", "Task successfully transitioned to in_progress after dependency completed");
  } else {
    record("Valid Dependency Transition Allowed", "FAIL", validTransErr?.message ?? "Update failed");
  }

  // 4. Overlapping Time Entries Prevention (GIST exclude constraint)
  const baseTime = new Date("2026-11-15T09:00:00Z");
  const t1Start = baseTime.toISOString();
  const t1End = new Date(baseTime.getTime() + 2 * 3600000).toISOString(); // 09:00 - 11:00

  const { data: entry1, error: e1Err } = await serviceClient.from("time_entries").insert({
    task_id: task1.id,
    employee_id: employeeTableId,
    started_at: t1Start,
    ended_at: t1End,
    notes: "Session 1",
  }).select("id").single();

  if (e1Err || !entry1) throw new Error(`Initial time entry failed: ${e1Err?.message}`);

  // Attempt overlapping entry: 10:00 - 12:00 for the same employee
  const t2Start = new Date(baseTime.getTime() + 1 * 3600000).toISOString(); // 10:00
  const t2End = new Date(baseTime.getTime() + 3 * 3600000).toISOString();   // 12:00

  const { error: overlapErr } = await serviceClient.from("time_entries").insert({
    task_id: task2.id,
    employee_id: employeeTableId,
    started_at: t2Start,
    ended_at: t2End,
    notes: "Overlapping session",
  });

  if (overlapErr && (overlapErr.code === "23P01" || overlapErr.message.includes("time_entries_no_overlap"))) {
    record("Time Entries Overlap Prevention", "PASS", "GIST exclude constraint prevented overlapping time range for employee");
  } else {
    record("Time Entries Overlap Prevention", "FAIL", `Expected overlap exclusion, got: ${overlapErr?.message}`);
  }

  // 5. Employee Time Entry Cross-Edit Protection (RLS)
  // Create an admin-owned time entry
  const { data: adminEmployeeRec } = await serviceClient.from("employees").select("id").eq("profile_id", adminId).maybeSingle();
  let adminEmpTableId = adminEmployeeRec?.id;
  if (!adminEmpTableId) {
    const { data: newAdminEmp } = await serviceClient.from("employees").insert({
      profile_id: adminId,
      employment_status: "active",
      job_title: "Administrator",
    }).select("id").single();
    adminEmpTableId = newAdminEmp.id;
  }

  const { data: adminTimeEntry } = await serviceClient.from("time_entries").insert({
    task_id: task1.id,
    employee_id: adminEmpTableId,
    started_at: "2026-11-16T14:00:00Z",
    ended_at: "2026-11-16T15:00:00Z",
    notes: "Admin time",
  }).select("id").single();

  // Employee attempts to update admin's time entry
  const { error: crossTimeErr } = await employeeAuthClient.from("time_entries").update({
    notes: "Hacked notes",
  }).eq("id", adminTimeEntry.id);

  const { data: verifyTimeEntry } = await serviceClient.from("time_entries").select("notes").eq("id", adminTimeEntry.id).single();
  if (crossTimeErr || verifyTimeEntry.notes === "Admin time") {
    record("Employee Time Entry Protection", "PASS", "Employee cannot edit another employee's time entries (RLS protected)");
  } else {
    record("Employee Time Entry Protection", "FAIL", "Employee updated another employee's time entry");
  }

  // 6. Checklist & Task Comments Authorization Inheritance
  // Employee adds checklist item to assigned task
  const { data: checklistItem, error: clErr } = await employeeAuthClient.from("task_checklist_items").insert({
    task_id: task2.id,
    title: "Verify acceptance criteria",
    created_by: empId,
  }).select("id").single();

  if (!clErr && checklistItem) {
    record("Task Checklist Item Authorized", "PASS", "Employee added checklist item to authorized task");
  } else {
    record("Task Checklist Item Authorized", "FAIL", clErr?.message ?? "Checklist insert failed");
  }

  // Employee adds comment to authorized task
  const { data: commentItem, error: commentErr } = await employeeAuthClient.from("task_comments").insert({
    task_id: task2.id,
    body: "Working on the implementation now.",
    author_id: empId,
  }).select("id").single();

  if (!commentErr && commentItem) {
    record("Task Comment Authorization", "PASS", "Employee posted comment on authorized task");
  } else {
    record("Task Comment Authorization", "FAIL", commentErr?.message ?? "Comment insert failed");
  }

  // 7. Cleanup
  await serviceClient.from("time_entries").delete().eq("task_id", task1.id);
  await serviceClient.from("time_entries").delete().eq("task_id", task2.id);
  await serviceClient.from("task_comments").delete().eq("task_id", task2.id);
  await serviceClient.from("task_checklist_items").delete().eq("task_id", task2.id);
  await serviceClient.from("task_dependencies").delete().eq("task_id", task2.id);
  await serviceClient.from("tasks").delete().eq("id", taskA.id);
  await serviceClient.from("tasks").delete().eq("id", taskB.id);
  await serviceClient.from("tasks").delete().eq("id", task1.id);
  await serviceClient.from("tasks").delete().eq("id", task2.id);
  await serviceClient.from("project_members").delete().eq("project_id", testProj.id);
  await serviceClient.from("projects").delete().eq("id", testProj.id);

  console.log("\n=========================================================================");
  console.log("Test Name                                  | Status   | Details");
  console.log("-------------------------------------------------------------------------");
  for (const r of results) {
    console.log(`${r.testName.padEnd(42)} | ${r.status.padEnd(8)} | ${r.details}`);
  }
  console.log("=========================================================================\n");

  const anyFail = results.some((r) => r.status === "FAIL");
  if (anyFail) {
    throw new Error("One or more advanced task audit tests failed");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
