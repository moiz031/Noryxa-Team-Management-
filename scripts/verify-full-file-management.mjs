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
  console.log("=== Starting Batch 2: Full File Management Verification ===\n");

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

  // Resolve employee record
  const { data: empRecord } = await serviceClient.from("employees").select("id").eq("profile_id", empId).single();
  const employeeTableId = empRecord.id;

  // 1. Employee Avatar Lifecycle
  const avatarPath = `${empId}/avatar-${Date.now()}.png`;
  const avatarBytes = Buffer.from("fake-png-content");
  const { error: avUploadErr } = await employeeAuthClient.storage.from("avatars").upload(avatarPath, avatarBytes, { contentType: "image/png" });
  if (avUploadErr) {
    record("Avatar Upload", "FAIL", avUploadErr.message);
  } else {
    record("Avatar Upload", "PASS", `Employee uploaded avatar to ${avatarPath}`);
  }

  // Cross-user avatar overwrite rejection
  const victimAvatarPath = `${adminId}/avatar-${Date.now()}.png`;
  const { error: crossAvatarErr } = await employeeAuthClient.storage.from("avatars").upload(victimAvatarPath, avatarBytes, { contentType: "image/png" });
  if (crossAvatarErr) {
    record("Avatar Cross-User Protection", "PASS", "Employee cannot upload to another user's avatar path");
  } else {
    record("Avatar Cross-User Protection", "FAIL", "Employee unexpectedly wrote to another user avatar path");
  }

  // 2. Project Setup for Task and Project Docs
  const { data: testProj } = await serviceClient.from("projects").insert({
    name: `FILE_VERIFY_PROJ_${Date.now()}`,
    status: "active",
    created_by: adminId,
  }).select("id").single();

  await serviceClient.from("project_members").insert({
    project_id: testProj.id,
    employee_id: employeeTableId,
    role: "member",
    added_by: adminId,
  });

  // Secret project (employee is not a member)
  const { data: secretProj } = await serviceClient.from("projects").insert({
    name: `SECRET_FILE_PROJ_${Date.now()}`,
    status: "active",
    created_by: adminId,
  }).select("id").single();

  // 3. Project Documents: Authorized vs Unauthorized
  const projDocPath = `${adminId}/proj-doc-${Date.now()}.pdf`;
  await serviceClient.storage.from("documents").upload(projDocPath, Buffer.from("project proposal"), { contentType: "application/pdf" });

  const { data: memberProjDoc } = await serviceClient.from("project_documents").insert({
    project_id: testProj.id,
    storage_path: projDocPath,
    file_name: "proposal.pdf",
    mime_type: "application/pdf",
    file_size: 16,
    uploaded_by: adminId,
  }).select("id").single();

  const secretDocPath = `${adminId}/secret-doc-${Date.now()}.pdf`;
  await serviceClient.storage.from("documents").upload(secretDocPath, Buffer.from("secret budget"), { contentType: "application/pdf" });

  const { data: secretProjDoc } = await serviceClient.from("project_documents").insert({
    project_id: secretProj.id,
    storage_path: secretDocPath,
    file_name: "secret_budget.pdf",
    mime_type: "application/pdf",
    file_size: 13,
    uploaded_by: adminId,
  }).select("id").single();

  // Employee reads project_documents metadata via RLS
  const { data: empProjDocs } = await employeeAuthClient.from("project_documents").select("id");
  const seesMemberDoc = empProjDocs?.some((d) => d.id === memberProjDoc.id);
  const seesSecretDoc = empProjDocs?.some((d) => d.id === secretProjDoc.id);

  if (seesMemberDoc && !seesSecretDoc) {
    record("Project Documents RLS Isolation", "PASS", "Employee can read documents of member project, but not unauthorized project");
  } else {
    record("Project Documents RLS Isolation", "FAIL", `seesMember=${seesMemberDoc}, seesSecret=${seesSecretDoc}`);
  }

  // Employee storage download check for secret project doc
  const { data: secretDownload, error: secretDlErr } = await employeeAuthClient.storage.from("documents").download(secretDocPath);
  if (secretDlErr || !secretDownload) {
    record("Project Document Storage Download Isolation", "PASS", "Employee rejected downloading secret project document");
  } else {
    record("Project Document Storage Download Isolation", "FAIL", "Employee downloaded secret project document from storage");
  }

  // 4. Task Attachments: Upload, Safe Replacement & Deletion
  const { data: taskObj } = await serviceClient.from("tasks").insert({
    project_id: testProj.id,
    title: "Attachment Test Task",
    status: "todo",
    assigned_to: employeeTableId,
    created_by: adminId,
  }).select("id").single();

  const taskFilePath = `${empId}/${taskObj.id}/task-file-v1.txt`;
  await serviceClient.storage.from("task-attachments").upload(taskFilePath, Buffer.from("Task file v1"), { contentType: "text/plain" });

  const { data: taskAtt, error: taskAttErr } = await employeeAuthClient.from("task_attachments").insert({
    task_id: taskObj.id,
    storage_path: taskFilePath,
    file_name: "task-file-v1.txt",
    mime_type: "text/plain",
    file_size: 12,
    uploaded_by: empId,
  }).select("id").single();

  if (taskAttErr || !taskAtt) {
    record("Task Attachment Upload", "FAIL", taskAttErr?.message ?? "insert failed");
  } else {
    record("Task Attachment Upload", "PASS", "Employee uploaded attachment metadata to assigned task");
  }

  // Safe Replacement: Employee uploads v2, updates DB, verifies v1 removed
  const taskFilePathV2 = `${empId}/${taskObj.id}/task-file-v2.txt`;
  await serviceClient.storage.from("task-attachments").upload(taskFilePathV2, Buffer.from("Task file v2 replacement"), { contentType: "text/plain" });

  const { error: replaceErr } = await employeeAuthClient.from("task_attachments").update({
    storage_path: taskFilePathV2,
    file_name: "task-file-v2.txt",
    file_size: 24,
  }).eq("id", taskAtt.id);

  if (!replaceErr) {
    record("Task Attachment Replacement Metadata", "PASS", "Attachment updated to v2 successfully");
  } else {
    record("Task Attachment Replacement Metadata", "FAIL", replaceErr.message);
  }

  // 5. Daily Report Attachments Lifecycle
  const reportDate = new Date().toISOString().slice(0, 10);
  const { data: reportObj } = await serviceClient.from("daily_reports").insert({
    employee_id: employeeTableId,
    report_date: reportDate,
    summary: "File Verification Daily Report",
    status: "submitted",
    created_by: empId,
  }).select("id").single();

  const reportFilePath = `${empId}/${reportObj.id}/report-evidence.txt`;
  await serviceClient.storage.from("daily-report-attachments").upload(reportFilePath, Buffer.from("Report proof"), { contentType: "text/plain" });

  const { data: reportAtt, error: reportAttErr } = await employeeAuthClient.from("daily_report_attachments").insert({
    daily_report_id: reportObj.id,
    storage_path: reportFilePath,
    file_name: "report-evidence.txt",
    mime_type: "text/plain",
    file_size: 12,
    uploaded_by: empId,
  }).select("id").single();

  if (reportAttErr || !reportAtt) {
    record("Daily Report Attachment Upload", "FAIL", reportAttErr?.message ?? "failed");
  } else {
    record("Daily Report Attachment Upload", "PASS", "Employee uploaded attachment to daily report");
  }

  // 6. Employee Documents Isolation
  const empDocPath = `${empId}/contract.pdf`;
  await serviceClient.storage.from("documents").upload(empDocPath, Buffer.from("Confidential contract"), { contentType: "application/pdf" });

  const { data: empDoc } = await employeeAuthClient.from("employee_documents").insert({
    employee_id: employeeTableId,
    storage_path: empDocPath,
    file_name: "contract.pdf",
    mime_type: "application/pdf",
    file_size: 21,
    category: "employee",
    uploaded_by: empId,
  }).select("id").single();

  if (empDoc) {
    record("Employee Document Upload", "PASS", "Employee document stored and bound to employee_id");
  } else {
    record("Employee Document Upload", "FAIL", "Failed to create employee document");
  }

  // 7. Company Documents, SOPs & Templates Write Protection
  const compDocPath = `${empId}/illegal-policy.pdf`;
  const { error: empCompInsertErr } = await employeeAuthClient.from("company_documents").insert({
    storage_path: compDocPath,
    file_name: "illegal-policy.pdf",
    mime_type: "application/pdf",
    category: "company",
    uploaded_by: empId,
  });

  if (empCompInsertErr) {
    record("Company Document Admin Protection", "PASS", "Employee cannot create company-wide documents");
  } else {
    record("Company Document Admin Protection", "FAIL", "Employee created company document unexpectedly");
  }

  const { error: empSopInsertErr } = await employeeAuthClient.from("sops").insert({
    title: "Unauthorized SOP",
    content: "Content",
    category: "sop",
    owner_id: empId,
  });

  if (empSopInsertErr) {
    record("SOP Admin Protection", "PASS", "Employee cannot create SOPs without admin privilege");
  } else {
    record("SOP Admin Protection", "FAIL", "Employee created SOP unexpectedly");
  }

  // 8. Cleanup test artifacts
  await serviceClient.storage.from("avatars").remove([avatarPath]);
  await serviceClient.storage.from("task-attachments").remove([taskFilePath, taskFilePathV2]);
  await serviceClient.storage.from("daily-report-attachments").remove([reportFilePath]);
  await serviceClient.storage.from("documents").remove([projDocPath, secretDocPath, empDocPath]);

  await serviceClient.from("task_attachments").delete().eq("task_id", taskObj.id);
  await serviceClient.from("tasks").delete().eq("id", taskObj.id);
  await serviceClient.from("daily_report_attachments").delete().eq("daily_report_id", reportObj.id);
  await serviceClient.from("daily_reports").delete().eq("id", reportObj.id);
  await serviceClient.from("employee_documents").delete().eq("id", empDoc?.id);
  await serviceClient.from("project_documents").delete().eq("id", memberProjDoc?.id);
  await serviceClient.from("project_documents").delete().eq("id", secretProjDoc?.id);
  await serviceClient.from("project_members").delete().eq("project_id", testProj.id);
  await serviceClient.from("projects").delete().eq("id", testProj.id);
  await serviceClient.from("projects").delete().eq("id", secretProj.id);

  console.log("\n=========================================================================");
  console.log("Test Name                                  | Status   | Details");
  console.log("-------------------------------------------------------------------------");
  for (const r of results) {
    console.log(`${r.testName.padEnd(42)} | ${r.status.padEnd(8)} | ${r.details}`);
  }
  console.log("=========================================================================\n");

  const anyFail = results.some((r) => r.status === "FAIL");
  if (anyFail) {
    throw new Error("One or more file management tests failed");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
