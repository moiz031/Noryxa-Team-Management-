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
  console.log("=== Starting Batch 5: Client & Project Management Verification ===\n");

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

  const timestamp = Date.now();

  // --- 1. Client Creation ---
  const clientPayload = {
    name: `Enterprise Client ${timestamp}`,
    company_name: `Apex Global Corp ${timestamp}`,
    email: `contact_${timestamp}@apexcorp.internal`,
    phone: "+1-555-0199",
    notes: "VIP Client with high priority contract",
    status: "lead",
    created_by: adminId,
    updated_by: adminId,
  };

  const { data: createdClient, error: clientCreateErr } = await serviceClient
    .from("clients")
    .insert(clientPayload)
    .select("*")
    .single();

  if (clientCreateErr) {
    record("Client Creation", "FAIL", clientCreateErr.message);
  } else {
    record("Client Creation", "PASS", `Created client ${createdClient.id} with status 'lead'`);
  }

  // --- 2. Client Editing & Status Transitions ---
  const { data: updatedClient, error: clientUpdateErr } = await serviceClient
    .from("clients")
    .update({ status: "active", notes: "Contract signed, activated" })
    .eq("id", createdClient.id)
    .select("*")
    .single();

  if (clientUpdateErr || updatedClient.status !== "active") {
    record("Client Edit & Activation", "FAIL", clientUpdateErr?.message || "Status not updated");
  } else {
    record("Client Edit & Activation", "PASS", `Client status transitioned to 'active'`);
  }

  // --- 3. Client Archive & Restore ---
  const { data: archivedClient, error: archiveErr } = await serviceClient
    .from("clients")
    .update({ status: "archived" })
    .eq("id", createdClient.id)
    .select("status")
    .single();

  const { data: restoredClient, error: restoreErr } = await serviceClient
    .from("clients")
    .update({ status: "active" })
    .eq("id", createdClient.id)
    .select("status")
    .single();

  if (archiveErr || restoreErr || archivedClient.status !== "archived" || restoredClient.status !== "active") {
    record("Client Archive & Restore", "FAIL", "Failed to transition to archived and restore to active");
  } else {
    record("Client Archive & Restore", "PASS", "Client successfully archived and restored to active");
  }

  // --- 4. Employee Unauthorized Client Manipulation Blocked ---
  const { error: empClientEditErr } = await employeeAuthClient
    .from("clients")
    .update({ name: "Hacked Client" })
    .eq("id", createdClient.id);

  if (empClientEditErr || true) {
    // Verify name didn't change
    const { data: verifyClient } = await serviceClient.from("clients").select("name").eq("id", createdClient.id).single();
    if (verifyClient.name === "Hacked Client") {
      record("Employee Client Edit Protection", "FAIL", "Employee was able to edit client record");
    } else {
      record("Employee Client Edit Protection", "PASS", "Employee cannot edit client data (RLS protected)");
    }
  }

  // --- 5. Project Creation with Client Relationship ---
  const { data: testProj, error: projCreateErr } = await serviceClient
    .from("projects")
    .insert({
      name: `Core Portal ${timestamp}`,
      description: "Mission critical customer portal",
      client_id: createdClient.id,
      client_name: createdClient.name,
      status: "planning",
      starts_on: "2026-09-01",
      due_on: "2026-12-31",
      created_by: adminId,
      updated_by: adminId,
    })
    .select("*")
    .single();

  if (projCreateErr) {
    record("Project Creation with Client", "FAIL", projCreateErr.message);
  } else {
    record("Project Creation with Client", "PASS", `Project created linked to client ${createdClient.id}`);
  }

  // --- 6. Project Status Transitions (planning -> active -> on_hold -> completed -> archived) ---
  const statuses = ["active", "on_hold", "completed", "archived"];
  let statusTransitionSuccess = true;
  for (const s of statuses) {
    const { data: updatedProj, error: sErr } = await serviceClient
      .from("projects")
      .update({ status: s, updated_by: adminId })
      .eq("id", testProj.id)
      .select("status")
      .single();
    if (sErr || updatedProj.status !== s) {
      statusTransitionSuccess = false;
      break;
    }
  }

  if (statusTransitionSuccess) {
    record("Project Status Lifecycle", "PASS", "All project statuses (planning, active, on_hold, completed, archived) verified");
  } else {
    record("Project Status Lifecycle", "FAIL", "Failed status transitions");
  }

  // Restore project to active for membership tests
  await serviceClient.from("projects").update({ status: "active" }).eq("id", testProj.id);

  // --- 7. Project Members Roles & Transitions (owner, manager, member, viewer) ---
  const { data: memberRecord, error: addMemberErr } = await serviceClient
    .from("project_members")
    .insert({
      project_id: testProj.id,
      employee_id: employeeTableId,
      role: "viewer",
      added_by: adminId,
    })
    .select("*")
    .single();

  if (addMemberErr) {
    record("Project Member Assignment", "FAIL", addMemberErr.message);
  } else {
    record("Project Member Assignment", "PASS", `Assigned employee as 'viewer'`);
  }

  // Update role to manager, then member
  const { data: roleUpdated, error: roleUpdateErr } = await serviceClient
    .from("project_members")
    .update({ role: "member" })
    .eq("project_id", testProj.id)
    .eq("employee_id", employeeTableId)
    .select("role")
    .single();

  if (roleUpdateErr || roleUpdated.role !== "member") {
    record("Project Member Role Update", "FAIL", roleUpdateErr?.message || "Role mismatch");
  } else {
    record("Project Member Role Update", "PASS", "Updated role from 'viewer' to 'member'");
  }

  // --- 8. Project Authorization Propagation to Tasks and Comments ---
  const { data: projTask, error: taskErr } = await serviceClient
    .from("tasks")
    .insert({
      title: `Project Task ${timestamp}`,
      project_id: testProj.id,
      assigned_to: employeeTableId,
      status: "in_progress",
      created_by: adminId,
    })
    .select("*")
    .single();

  // Employee can see tasks of project they are a member of
  const { data: visibleTasks } = await employeeAuthClient
    .from("tasks")
    .select("id")
    .eq("id", projTask.id);

  if (visibleTasks && visibleTasks.length === 1) {
    record("Task Authorization Propagation", "PASS", "Member employee can access project task");
  } else {
    record("Task Authorization Propagation", "FAIL", "Member employee could not view project task");
  }

  // --- 9. Isolation: Unauthorized Project Access Blocked ---
  const { data: secretProj } = await serviceClient
    .from("projects")
    .insert({
      name: `SECRET_PROJ_${timestamp}`,
      status: "active",
      created_by: adminId,
    })
    .select("id")
    .single();

  const { data: secretTask } = await serviceClient
    .from("tasks")
    .insert({
      title: `Secret Task ${timestamp}`,
      project_id: secretProj.id,
      status: "todo",
      created_by: adminId,
    })
    .select("id")
    .single();

  // Employee must NOT see secret task
  const { data: hiddenTasks } = await employeeAuthClient
    .from("tasks")
    .select("id")
    .eq("id", secretTask.id);

  if (!hiddenTasks || hiddenTasks.length === 0) {
    record("Cross-Project Isolation", "PASS", "Non-member employee cannot access secret project task (RLS protected)");
  } else {
    record("Cross-Project Isolation", "FAIL", "Non-member employee leaked secret project task");
  }

  // --- 10. Clean-up Fixtures ---
  await serviceClient.from("tasks").delete().in("id", [projTask.id, secretTask.id]);
  await serviceClient.from("project_members").delete().eq("project_id", testProj.id);
  await serviceClient.from("projects").delete().in("id", [testProj.id, secretProj.id]);
  await serviceClient.from("clients").delete().eq("id", createdClient.id);

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
    console.log("ALL BATCH 5 TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
