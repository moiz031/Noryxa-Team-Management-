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
  console.log("=== Starting Batch 6: Communication System Finalization ===\n");

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

  // --- Setup Context: Project with Admin and Employee as member ---
  const { data: testProj } = await serviceClient
    .from("projects")
    .insert({
      name: `COMM_PROJ_${timestamp}`,
      status: "active",
      created_by: adminId,
    })
    .select("id")
    .single();

  await serviceClient.from("project_members").insert({
    project_id: testProj.id,
    employee_id: employeeTableId,
    role: "member",
    added_by: adminId,
  });

  // --- 1. Feed Post Creation (Scoped to project) ---
  const { data: post1, error: post1Err } = await adminAuthClient
    .from("feed_posts")
    .insert({
      project_id: testProj.id,
      author_id: adminId,
      body: `Project kickoff update ${timestamp}`,
    })
    .select("*")
    .single();

  if (post1Err) {
    record("Admin Feed Post Creation", "FAIL", post1Err.message);
  } else {
    record("Admin Feed Post Creation", "PASS", `Created post ${post1.id} for project ${testProj.id}`);
  }

  // --- 2. Threaded Comment & Reply ---
  const { data: comment1, error: comErr } = await employeeAuthClient
    .from("feed_comments")
    .insert({
      post_id: post1.id,
      author_id: empId,
      body: `Excited for this project! Reply ${timestamp}`,
    })
    .select("*")
    .single();

  if (comErr) {
    record("Feed Comment Creation", "FAIL", comErr.message);
  } else {
    record("Feed Comment Creation", "PASS", `Employee posted comment ${comment1.id}`);
  }

  // Threaded reply
  const { data: reply1, error: repErr } = await adminAuthClient
    .from("feed_comments")
    .insert({
      post_id: post1.id,
      parent_comment_id: comment1.id,
      author_id: adminId,
      body: `Let's make it a success!`,
    })
    .select("*")
    .single();

  if (repErr) {
    record("Threaded Reply Creation", "FAIL", repErr.message);
  } else {
    record("Threaded Reply Creation", "PASS", `Admin replied to comment with parent_comment_id ${comment1.id}`);
  }

  // --- 3. Reaction & Duplicate Reaction Prevention ---
  const { data: react1, error: reactErr } = await employeeAuthClient
    .from("reactions")
    .insert({
      entity_type: "feed_post",
      entity_id: post1.id,
      reaction: "celebrate",
      actor_id: empId,
    })
    .select("*")
    .single();

  if (reactErr) {
    record("Add Reaction", "FAIL", reactErr.message);
  } else {
    record("Add Reaction", "PASS", `Employee added reaction 'celebrate' to post`);
  }

  // Duplicate reaction attempt (unique constraint)
  const { error: dupReactErr } = await employeeAuthClient
    .from("reactions")
    .insert({
      entity_type: "feed_post",
      entity_id: post1.id,
      reaction: "celebrate",
      actor_id: empId,
    });

  if (dupReactErr) {
    record("Duplicate Reaction Prevention", "PASS", `Duplicate reaction blocked by constraint: ${dupReactErr.code || dupReactErr.message}`);
  } else {
    record("Duplicate Reaction Prevention", "FAIL", "Duplicate reaction was allowed");
  }

  // Remove reaction
  const { error: delReactErr } = await employeeAuthClient
    .from("reactions")
    .delete()
    .match({ entity_type: "feed_post", entity_id: post1.id, actor_id: empId, reaction: "celebrate" });

  if (delReactErr) {
    record("Remove Reaction", "FAIL", delReactErr.message);
  } else {
    record("Remove Reaction", "PASS", "Employee removed reaction");
  }

  // --- 4. Notification Generation & Deduplication ---
  const dedupeKey = `mention_${post1.id}_${empId}_${timestamp}`;
  const { data: notif1, error: notif1Err } = await serviceClient
    .from("notifications")
    .insert({
      recipient_id: empId,
      actor_id: adminId,
      type: "feed.mention",
      title: "You were mentioned in a feed post",
      body: `Admin mentioned you in project update`,
      entity_type: "feed_post",
      entity_id: post1.id,
      dedupe_key: dedupeKey,
    })
    .select("*")
    .single();

  if (notif1Err) {
    record("Notification Creation", "FAIL", notif1Err.message);
  } else {
    record("Notification Creation", "PASS", `Notification created with dedupe_key ${dedupeKey}`);
  }

  // Deduplication check
  const { error: dupNotifErr } = await serviceClient
    .from("notifications")
    .insert({
      recipient_id: empId,
      actor_id: adminId,
      type: "feed.mention",
      title: "Duplicate mention",
      body: "Duplicate body",
      entity_type: "feed_post",
      entity_id: post1.id,
      dedupe_key: dedupeKey,
    });

  if (dupNotifErr) {
    record("Notification Deduplication", "PASS", `Duplicate notification blocked by unique dedupe_key`);
  } else {
    record("Notification Deduplication", "FAIL", "Duplicate notification with same dedupe_key was inserted");
  }

  // --- 5. Notification Read/Unread State Transitions ---
  const readTimestamp = new Date().toISOString();
  const { data: markedNotif, error: markErr } = await employeeAuthClient
    .from("notifications")
    .update({ read_at: readTimestamp })
    .eq("id", notif1.id)
    .select("read_at")
    .single();

  if (markErr || !markedNotif.read_at) {
    record("Notification Mark Read", "FAIL", markErr?.message || "read_at was not set");
  } else {
    record("Notification Mark Read", "PASS", "Employee marked notification as read (read_at set)");
  }

  // Mark all read
  const { error: markAllErr } = await employeeAuthClient
    .from("notifications")
    .update({ read_at: readTimestamp })
    .eq("recipient_id", empId);

  if (markAllErr) {
    record("Notification Mark All Read", "FAIL", markAllErr.message);
  } else {
    record("Notification Mark All Read", "PASS", "Mark all read completed successfully");
  }

  // --- 6. Cross-User Notification RLS Protection ---
  const { data: adminNotifs } = await employeeAuthClient
    .from("notifications")
    .select("id")
    .eq("recipient_id", adminId);

  if (!adminNotifs || adminNotifs.length === 0) {
    record("Notification Recipient RLS Isolation", "PASS", "Employee cannot view another user's notifications (RLS protected)");
  } else {
    record("Notification Recipient RLS Isolation", "FAIL", "Employee accessed admin notifications");
  }

  // --- 7. Clean-up Fixtures ---
  await serviceClient.from("notifications").delete().eq("id", notif1.id);
  await serviceClient.from("feed_comments").delete().in("id", [comment1.id, reply1.id]);
  await serviceClient.from("feed_posts").delete().eq("id", post1.id);
  await serviceClient.from("project_members").delete().eq("project_id", testProj.id);
  await serviceClient.from("projects").delete().eq("id", testProj.id);

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
    console.log("ALL BATCH 6 TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
