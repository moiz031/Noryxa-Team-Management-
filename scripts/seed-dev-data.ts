import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SupabaseClient } from '@supabase/supabase-js';

/** Tag used to identify seeded rows for easy cleanup. */
export const SEED_TAG = 'dev_seed';

/** Stable non-Auth fixture IDs. Auth-backed IDs are resolved at runtime. */
export const SEED_IDS = {
  department: '00000000-0000-0000-0000-000000000004',
  team: '00000000-0000-0000-0000-000000000005',
  client: '00000000-0000-0000-0000-000000000006',
  project: '00000000-0000-0000-0000-000000000007',
  task: '00000000-0000-0000-0000-000000000008',
  report: '00000000-0000-0000-0000-00000000000a',
  attendance: '00000000-0000-0000-0000-00000000000b',
  leave: '00000000-0000-0000-0000-00000000000c',
  notification: '00000000-0000-0000-0000-00000000000d',
  feed: '00000000-0000-0000-0000-00000000000e',
  fileMeta: '00000000-0000-0000-0000-00000000000f',
};

type RuntimeIds = typeof SEED_IDS & {
  adminProfile: string;
  employeeProfile: string;
  employee: string;
};

async function upsert<T extends Record<string, unknown>>(
  db: SupabaseClient,
  table: string,
  payload: T,
  conflict = 'id',
) {
  const { error } = await db.from(table).upsert({ ...payload, seed_tag: SEED_TAG }, { onConflict: conflict });
  if (error) throw new Error(`Seed ${table} failed: ${error.message}`);
}

async function resolveRuntimeIds(db: SupabaseClient): Promise<RuntimeIds> {
  const adminEmail = process.env.VERIFY_ADMIN_EMAIL || 'verify.admin@agency-os.internal';
  const employeeEmail = process.env.VERIFY_EMPLOYEE_EMAIL || 'verify.employee@agency-os.internal';
  const users = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(`Seed could not list Auth users: ${users.error.message}`);
  const admin = users.data.users.find((user) => user.email?.toLowerCase() === adminEmail.toLowerCase());
  const employee = users.data.users.find((user) => user.email?.toLowerCase() === employeeEmail.toLowerCase());
  if (!admin || !employee) {
    throw new Error('Seed requires the configured verification admin and employee Auth users.');
  }
  const employeeRecord = await db.from('employees').select('id').eq('profile_id', employee.id).single();
  if (employeeRecord.error || !employeeRecord.data) {
    throw new Error(`Seed could not resolve the verification employee row: ${employeeRecord.error?.message}`);
  }
  return {
    ...SEED_IDS,
    adminProfile: admin.id,
    employeeProfile: employee.id,
    employee: employeeRecord.data.id,
  };
}

/** Seed current-schema fixtures using real verification Auth identities. */
export async function seed() {
  const db = createSupabaseAdminClient();
  const ids = await resolveRuntimeIds(db);

  await upsert(db, 'departments', { id: ids.department, name: 'Engineering' });
  await upsert(db, 'teams', {
    id: ids.team,
    name: 'Backend Team',
    department_id: ids.department,
    created_by: ids.adminProfile,
  });
  await upsert(db, 'clients', {
    id: ids.client,
    name: 'Acme Corp',
    status: 'active',
    created_by: ids.adminProfile,
  });
  await upsert(db, 'projects', {
    id: ids.project,
    name: 'Acme Integration',
    client_id: ids.client,
    status: 'active',
    created_by: ids.adminProfile,
  });
  await upsert(db, 'project_members', {
    project_id: ids.project,
    employee_id: ids.employee,
    role: 'member',
    added_by: ids.adminProfile,
  }, 'project_id,employee_id');
  await upsert(db, 'tasks', {
    id: ids.task,
    title: 'Seeded Task',
    status: 'todo',
    priority: 'medium',
    created_by: ids.adminProfile,
    assigned_to: ids.employee,
    project_id: ids.project,
  });
  await upsert(db, 'daily_reports', {
    id: ids.report,
    employee_id: ids.employee,
    report_date: '2026-01-01',
    summary: 'Seeded daily report',
    status: 'submitted',
    created_by: ids.employeeProfile,
  });
  await upsert(db, 'attendance', {
    id: ids.attendance,
    employee_id: ids.employee,
    attendance_date: '2026-01-01',
    check_in_at: '2026-01-01T09:00:00Z',
    status: 'present',
    created_by: ids.employeeProfile,
  });
  await upsert(db, 'leave_requests', {
    id: ids.leave,
    employee_id: ids.employee,
    leave_type: 'vacation',
    starts_on: '2026-02-01',
    ends_on: '2026-02-05',
    status: 'approved',
    reviewed_by: ids.adminProfile,
    reviewed_at: '2026-01-15T00:00:00Z',
    created_by: ids.employeeProfile,
  });
  await upsert(db, 'notifications', {
    id: ids.notification,
    recipient_id: ids.employeeProfile,
    actor_id: ids.adminProfile,
    type: 'system_alert',
    title: 'Seeded Notification',
    body: 'This is a test notification',
  });
  await upsert(db, 'feed_posts', {
    id: ids.feed,
    author_id: ids.employeeProfile,
    project_id: ids.project,
    body: 'Seeded feed post',
  });
  await upsert(db, 'documents', {
    id: ids.fileMeta,
    title: 'seeded-file.txt',
    storage_path: 'seeded/file.txt',
    file_name: 'seeded-file.txt',
    mime_type: 'text/plain',
    file_size: 123,
    owner_id: ids.employee,
    uploaded_by: ids.adminProfile,
  });
}

/** Cleanup only rows tagged by this fixture; real Auth/profile rows are preserved. */
export async function cleanup() {
  const db = createSupabaseAdminClient();
  for (const table of [
    'documents', 'feed_posts', 'notifications', 'leave_requests', 'attendance',
    'daily_reports', 'tasks', 'project_members', 'projects', 'clients',
    'teams', 'departments',
  ]) {
    const { error } = await db.from(table).delete().eq('seed_tag', SEED_TAG);
    if (error) throw new Error(`Cleanup ${table} failed: ${error.message}`);
  }
}
