import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before cleanup.");
}

const db = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const seedTag = "dev_seed";
const tables = [
  "documents",
  "feed_posts",
  "notifications",
  "leave_requests",
  "attendance",
  "daily_reports",
  "tasks",
  "project_members",
  "projects",
  "clients",
  "teams",
  "departments",
];
const countColumn = (table) => table === "project_members" ? "project_id" : "id";

for (const table of tables) {
  const { count, error: countError } = await db
    .from(table)
    .select(countColumn(table), { count: "exact", head: true })
    .eq("seed_tag", seedTag);
  if (countError) throw new Error(`Could not inspect ${table}: ${countError.message}`);

  if ((count ?? 0) === 0) continue;

  const { error } = await db.from(table).delete().eq("seed_tag", seedTag);
  if (error) throw new Error(`Could not clean ${table}: ${error.message}`);
  console.log(`Removed ${count} demo row(s) from ${table}.`);
}

console.log("Demo data cleanup complete. Auth users and real profiles were preserved.");
