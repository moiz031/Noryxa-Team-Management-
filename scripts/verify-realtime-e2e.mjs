import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const pubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !pubKey || !serviceKey) {
  throw new Error("Missing required environment variables");
}

const adminClient = createClient(url, pubKey, { auth: { persistSession: false, autoRefreshToken: false } });
const employeeClient = createClient(url, pubKey, { auth: { persistSession: false, autoRefreshToken: false } });
const serviceClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function run() {
  console.log("=== Realtime E2E Verification ===");

  await adminClient.auth.signInWithPassword({
    email: process.env.VERIFY_ADMIN_EMAIL,
    password: process.env.VERIFY_ADMIN_PASSWORD,
  });
  
  await employeeClient.auth.signInWithPassword({
    email: process.env.VERIFY_EMPLOYEE_EMAIL,
    password: process.env.VERIFY_EMPLOYEE_PASSWORD,
  });

  const adminId = (await adminClient.auth.getUser()).data.user.id;
  const employeeId = (await employeeClient.auth.getUser()).data.user.id;
  const empProfileData = (await serviceClient.from('employees').select('id').eq('profile_id', employeeId).single()).data;
  const empId = empProfileData.id;

  const events = {
    taskUpdated: false,
    reportSubmitted: false,
    leaveRequested: false,
    leaveApproved: false,
    mentionNotified: false,
    notificationRead: false
  };

  const adminChannel = adminClient.channel('admin_realtime');
  const employeeChannel = employeeClient.channel('emp_realtime');

  adminChannel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'daily_reports' }, payload => {
    if (payload.new.employee_id === empId) events.reportSubmitted = true;
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leave_requests' }, payload => {
    if (payload.new.employee_id === empId) events.leaveRequested = true;
  });

  employeeChannel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, payload => {
    events.taskUpdated = true;
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leave_requests' }, payload => {
    if (payload.new.status === 'approved') events.leaveApproved = true;
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
    if (payload.new.type === 'mention') events.mentionNotified = true;
  })
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, payload => {
    if (payload.new.read_at) events.notificationRead = true;
  });

  const waitForSubscribed = (channel, label) => new Promise((resolve, reject) => {
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') resolve();
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        reject(new Error(`${label} realtime subscription ${status}`));
      }
    });
  });

  // Wait for both sockets to be subscribed before generating events.
  await Promise.all([
    waitForSubscribed(adminChannel, 'admin'),
    waitForSubscribed(employeeChannel, 'employee'),
  ]);

  console.log("Channels subscribed, triggering events...");

  // 1. Task Update (Admin updates task, employee listens)
  const proj = await serviceClient.from('projects').insert({ name: "RTest", status: "active", created_by: adminId }).select('id').single();
  if (proj.error || !proj.data) throw new Error(`Realtime project setup failed: ${proj.error?.message ?? "missing project"}`);
  const membership = await serviceClient.from('project_members').insert({ project_id: proj.data.id, employee_id: empId, role: "member", added_by: adminId });
  if (membership.error) throw new Error(`Realtime membership setup failed: ${membership.error.message}`);
  const task = await serviceClient.from('tasks').insert({ project_id: proj.data.id, title: "RT", status: "todo", assigned_to: empId, created_by: adminId }).select('id').single();
  if (task.error || !task.data) throw new Error(`Realtime task setup failed: ${task.error?.message ?? "missing task"}`);
  
  const taskUpdate = await adminClient.from('tasks').update({ status: "in_progress" }).eq('id', task.data.id);
  if (taskUpdate.error) throw new Error(`Realtime task update failed: ${taskUpdate.error.message}`);

  // 2. Report Submission (Employee creates report, Admin listens)
  const reportDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const reportInsert = await employeeClient.from('daily_reports').insert({
    employee_id: empId,
    report_date: reportDate,
    summary: "RT Report",
    status: "submitted",
    created_by: employeeId
  });
  if (reportInsert.error) throw new Error(`Realtime report insert failed: ${reportInsert.error.message}`);

  // 3. Leave Request (Employee creates, Admin listens)
  const leave = await employeeClient.from('leave_requests').insert({
    employee_id: empId,
    leave_type: "vacation",
    starts_on: "2027-01-01",
    ends_on: "2027-01-02",
    reason: "RT Leave",
    status: "pending",
    created_by: employeeId
  }).select('id').single();

  // 4. Leave Approval (Admin approves, Employee listens)
  if (leave.data) {
    await adminClient.from('leave_requests').update({ status: "approved" }).eq('id', leave.data.id);
  }

  // 5. Mention Notification (Admin mentions employee, Employee listens)
  const notif = await serviceClient.from('notifications').insert({
    recipient_id: employeeId,
    type: "mention",
    title: "RT Mention"
  }).select('id').single();

  // 6. Notification Read State (Employee reads, Employee listens to self update)
  if (notif.error) throw new Error(`Realtime notification setup failed: ${notif.error.message}`);
  if (notif.data) {
    const readUpdate = await employeeClient.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notif.data.id);
    if (readUpdate.error) throw new Error(`Realtime notification read update failed: ${readUpdate.error.message}`);
  }

  // wait for all events to arrive
  await new Promise(r => setTimeout(r, 4000));

  console.log("Results:", events);

  // Cleanup
  if (notif.data) await serviceClient.from('notifications').delete().eq('id', notif.data.id);
  if (leave.data) await serviceClient.from('leave_requests').delete().eq('id', leave.data.id);
  await serviceClient.from('daily_reports').delete().eq('employee_id', empId).eq('summary', "RT Report");
  if (task.data) await serviceClient.from('tasks').delete().eq('id', task.data.id);
  if (proj.data) await serviceClient.from('projects').delete().eq('id', proj.data.id);

  await adminClient.removeChannel(adminChannel);
  await employeeClient.removeChannel(employeeChannel);
  
  await adminClient.auth.signOut();
  await employeeClient.auth.signOut();

  const missing = Object.entries(events).filter(([, received]) => !received).map(([name]) => name);
  if (missing.length > 0) {
    console.error(`[FAIL] Realtime events were not delivered without refresh: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log("[PASS] All realtime events delivered successfully");
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
