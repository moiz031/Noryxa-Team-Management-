import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Generic CRUD helpers for Batch-2 admin tables:
 * teams, clients, holidays, project_members, schedules, schedule_assignments,
 * work_schedules, team_members
 */

type Batch2Table =
  | "teams"
  | "clients"
  | "holidays"
  | "project_members"
  | "schedules"
  | "schedule_assignments"
  | "work_schedules"
  | "team_members";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function listBatch2<T = Record<string, unknown>>(
  table: Batch2Table,
  filters: Record<string, string> = {},
  // PERF: Default limit of 100 prevents unbounded full-table scans.
  // Callers that need pagination should pass their own limit/offset.
  limit = 100,
  offset = 0,
): Promise<T[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list ${table}: ${error.message}`);
  return (data ?? []) as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertBatch2<T = Record<string, unknown>>(
  table: Batch2Table,
  row: Record<string, unknown>,
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(table)
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to insert into ${table}: ${error.message}`);
  return data as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateBatch2<T = Record<string, unknown>>(
  table: Batch2Table,
  id: string,
  updates: Record<string, unknown>,
): Promise<T> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update ${table}: ${error.message}`);
  return data as T;
}

/* ---------- DELETE ---------- */
export async function deleteBatch2(
  table: Batch2Table,
  id: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw new Error(`Failed to delete from ${table}: ${error.message}`);
}
