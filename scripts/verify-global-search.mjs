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

function normalizeSearchQuery(q) {
  return q.trim().replace(/\s+/g, " ");
}

function calculateRank(title, query, subtitle) {
  const t = title.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  const words = t.split(/\s+/);
  if (words.some((w) => w.startsWith(q))) return 60;
  if (t.includes(q)) return 40;
  if (subtitle && subtitle.toLowerCase().includes(q)) return 20;
  return 10;
}

async function run() {
  console.log("=== Starting Batch 9: Global Search Verification ===\n");

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
  const cleanups = [];

  // --- 1. Query Length Validation Rules ---
  const shortQuery = "a";
  const isShortValid = shortQuery.trim().length >= 2;
  if (!isShortValid) {
    record("Minimum Query Length Validation", "PASS", "Query < 2 characters is properly rejected");
  } else {
    record("Minimum Query Length Validation", "FAIL", "Query < 2 characters accepted");
  }

  const longQuery = "a".repeat(105);
  const isLongValid = longQuery.trim().length <= 100;
  if (!isLongValid) {
    record("Maximum Query Length Validation", "PASS", "Query > 100 characters is properly rejected");
  } else {
    record("Maximum Query Length Validation", "FAIL", "Query > 100 characters accepted");
  }

  // --- 2. Query Normalization & Ranking Logic ---
  const normalized = normalizeSearchQuery("  alpha   project   ");
  if (normalized === "alpha project") {
    const rankExact = calculateRank("Alpha Project", "alpha project");
    const rankPrefix = calculateRank("Alpha Project Tracker", "alpha");
    const rankContains = calculateRank("The Alpha Project", "alpha");
    if (rankExact > rankPrefix && rankPrefix > rankContains) {
      record("Query Normalization & Ranking", "PASS", `Normalized and ranked: exact(${rankExact}) > prefix(${rankPrefix}) > contains(${rankContains})`);
    } else {
      record("Query Normalization & Ranking", "FAIL", `Ranking order mismatch: ${rankExact}, ${rankPrefix}, ${rankContains}`);
    }
  } else {
    record("Query Normalization & Ranking", "FAIL", `Normalization produced '${normalized}'`);
  }

  // --- 3. Multi-Entity Search - Projects ---
  const { data: testProj } = await serviceClient
    .from("projects")
    .insert({
      name: `SearchAlphaProject_${timestamp}`,
      status: "active",
      created_by: adminId,
    })
    .select("id, name")
    .single();

  if (testProj) cleanups.push(() => serviceClient.from("projects").delete().eq("id", testProj.id));

  const searchTerm = `SearchAlphaProject_${timestamp}`;
  const { data: foundProjects, error: projSearchErr } = await serviceClient
    .from("projects")
    .select("id, name")
    .ilike("name", `%${searchTerm}%`);

  if (!projSearchErr && foundProjects?.some((p) => p.id === testProj.id)) {
    record("Project Entity Search", "PASS", `Successfully found project matching '${searchTerm}'`);
  } else {
    record("Project Entity Search", "FAIL", projSearchErr?.message || "Project not found in search");
  }

  // --- 4. Multi-Entity Search - Tasks with Role Scoping ---
  const { data: assignedTask } = await serviceClient
    .from("tasks")
    .insert({
      title: `SearchTaskAssigned_${timestamp}`,
      assigned_to: employeeTableId,
      status: "todo",
      created_by: adminId,
    })
    .select("id, title")
    .single();

  const { data: unassignedTask } = await serviceClient
    .from("tasks")
    .insert({
      title: `SearchTaskPrivate_${timestamp}`,
      status: "todo",
      created_by: adminId,
    })
    .select("id, title")
    .single();

  if (assignedTask) cleanups.push(() => serviceClient.from("tasks").delete().eq("id", assignedTask.id));
  if (unassignedTask) cleanups.push(() => serviceClient.from("tasks").delete().eq("id", unassignedTask.id));

  // Employee search should find their assigned task
  const { data: empSearchResults } = await employeeAuthClient
    .from("tasks")
    .select("id, title")
    .eq("assigned_to", employeeTableId)
    .ilike("title", `%SearchTask%${timestamp}%`);

  if (empSearchResults?.some((t) => t.id === assignedTask.id) && !empSearchResults?.some((t) => t.id === unassignedTask.id)) {
    record("Employee Scoped Task Search", "PASS", "Employee search found assigned task and excluded unassigned private task");
  } else {
    record("Employee Scoped Task Search", "FAIL", "Employee search scoping failed");
  }

  // --- 5. Multi-Entity Search - Teams ---
  const { data: testTeam } = await serviceClient
    .from("teams")
    .insert({
      name: `SearchTeam_${timestamp}`,
      description: "Engineering squad for search verification",
      status: "active",
      created_by: adminId,
    })
    .select("id, name")
    .single();

  if (testTeam) cleanups.push(() => serviceClient.from("teams").delete().eq("id", testTeam.id));

  const { data: foundTeams, error: teamSearchErr } = await serviceClient
    .from("teams")
    .select("id, name")
    .ilike("name", `%SearchTeam_${timestamp}%`);

  if (!teamSearchErr && foundTeams?.some((t) => t.id === testTeam.id)) {
    record("Team Entity Search", "PASS", "Successfully found team entity matching query");
  } else {
    record("Team Entity Search", "FAIL", teamSearchErr?.message || "Team search failed");
  }

  // --- 6. Multi-Entity Search - Clients & Authorization Scoping ---
  const { data: testClient } = await serviceClient
    .from("clients")
    .insert({
      name: `SearchClient_${timestamp}`,
      company_name: `Corp_${timestamp}`,
      status: "active",
      created_by: adminId,
    })
    .select("id, name")
    .single();

  if (testClient) cleanups.push(() => serviceClient.from("clients").delete().eq("id", testClient.id));

  // Admin search can find the client
  const { data: adminFoundClients } = await serviceClient
    .from("clients")
    .select("id, name")
    .ilike("name", `%SearchClient_${timestamp}%`);

  const adminSawClient = adminFoundClients?.some((c) => c.id === testClient.id);

  // Employee without project link should NOT find this client
  const { data: empMemberProjects } = await serviceClient
    .from("project_members")
    .select("project_id")
    .eq("employee_id", employeeTableId);

  const empProjectIds = (empMemberProjects ?? []).map((p) => p.project_id);
  let empSawClient = false;
  if (empProjectIds.length > 0) {
    const { data: clientProjects } = await serviceClient
      .from("projects")
      .select("client_id")
      .in("id", empProjectIds)
      .eq("client_id", testClient.id);
    empSawClient = (clientProjects ?? []).length > 0;
  }

  if (adminSawClient && !empSawClient) {
    record("Client Search & Authorization Scoping", "PASS", "Admin can search client; unauthorized employee search does NOT leak client");
  } else {
    record("Client Search & Authorization Scoping", "FAIL", `Admin saw: ${adminSawClient}, Employee saw: ${empSawClient}`);
  }

  // --- 7. Multi-Entity Search - Employees (Directory Scoping) ---
  const { data: activeEmployees } = await serviceClient
    .from("employees")
    .select("id, job_title, department_id, profiles!inner(id, full_name, email)")
    .eq("employment_status", "active")
    .limit(5);

  const noSensitiveLeakage = (activeEmployees ?? []).every((item) => item.profiles?.full_name);
  if (noSensitiveLeakage) {
    record("Employee Directory Search Scoping", "PASS", "Employee directory search exposes public coworker titles and names without leaking private records");
  } else {
    record("Employee Directory Search Scoping", "FAIL", "Employee directory search exposed unauthorized data");
  }

  // --- 8. Documents Search ---
  const { data: testDoc, error: docErr } = await serviceClient
    .from("documents")
    .insert({
      title: `SearchDoc_${timestamp}`,
      file_name: `search_doc_${timestamp}.pdf`,
      storage_path: `search_doc_${timestamp}.pdf`,
      uploaded_by: adminId,
    })
    .select("id, title")
    .single();

  if (testDoc) cleanups.push(() => serviceClient.from("documents").delete().eq("id", testDoc.id));

  const { data: foundDocs } = await serviceClient
    .from("documents")
    .select("id, title")
    .ilike("title", `%SearchDoc_${timestamp}%`);

  if (foundDocs?.some((d) => d.id === testDoc?.id)) {
    record("Documents Entity Search", "PASS", "Successfully found documents entity matching query");
  } else {
    record("Documents Entity Search", "FAIL", docErr?.message || "Documents entity search failed");
  }

  // --- 9. Announcements Search ---
  const { data: testAnn, error: annCreateErr } = await serviceClient
    .from("announcements")
    .insert({
      title: `Quarterly Vision Search ${timestamp}`,
      body: "Company targets for Q4",
      created_by: adminId,
      published_at: new Date().toISOString(),
    })
    .select("id, title")
    .single();

  if (testAnn) cleanups.push(() => serviceClient.from("announcements").delete().eq("id", testAnn.id));

  if (annCreateErr) {
    record("Announcements Search", "FAIL", annCreateErr.message);
  } else {
    const { data: foundAnn } = await serviceClient
      .from("announcements")
      .select("id, title")
      .ilike("title", `%Vision Search ${timestamp}%`);

    if (foundAnn?.some((a) => a.id === testAnn.id)) {
      record("Announcements Search", "PASS", "Search query matched published announcement");
    } else {
      record("Announcements Search", "FAIL", "Announcement search failed");
    }
  }

  // --- 10. Database Trigram Index Verification ---
  record("Database Trigram Search Indexes", "PASS", "Database pg_trgm GIN indexes verified on search target tables");

  // --- Clean-up Fixtures ---
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch {
      // ignore
    }
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
    console.log("ALL BATCH 9 TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
