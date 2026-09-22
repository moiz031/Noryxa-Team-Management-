import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityLog = {
  id: string;
  actor_id: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  source?: string | null;
  ip_address?: string | null;
  org_context?: Record<string, unknown>;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export type ActivityLogListParams = {
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  actionType?: string | null;
  source?: string | null;
  page?: number;
  pageSize?: number;
};

export async function getActivityLogs(params: ActivityLogListParams = {}): Promise<{ logs: ActivityLog[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { actorId, entityType, entityId, actionType, source, page = 1, pageSize = 50 } = params;
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 50;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from("activity_logs")
    .select(`id, actor_id, action_type, entity_type, entity_id, metadata, source, ip_address, org_context, created_at, profiles!left(full_name, email)`, { count: "planned" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (actorId) query = query.eq("actor_id", actorId);
  if (entityType) query = query.eq("entity_type", entityType);
  if (entityId) query = query.eq("entity_id", entityId);
  if (actionType) query = query.eq("action_type", actionType);
  if (source) query = query.eq("source", source);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch activity logs: ${error.message}`);
  return { logs: (data as unknown as ActivityLog[]) ?? [], total: count ?? 0 };
}

export async function getActivityLogById(id: string): Promise<ActivityLog | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select(`*, profiles!left(full_name, email)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch activity log: ${error.message}`);
  return data as ActivityLog | null;
}
