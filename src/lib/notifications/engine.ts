import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type NotificationInput = {
  recipientId: string;
  actorId?: string | null;
  type: string;
  title: string;
  body?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  preference?: "task_notifications" | "report_notifications" | "leave_notifications" | "mention_notifications" | "announcement_notifications";
  dedupeKey?: string;
};

export async function notify(input: NotificationInput) {
  const db = createSupabaseAdminClient();
  if (input.preference) {
    // PERF: Select only the required preference column instead of select("*") to avoid
    // fetching all columns from notification_preferences (N+1 column waste).
    const { data: preferences, error } = await db
      .from("notification_preferences")
      .select(input.preference)
      .eq("profile_id", input.recipientId)
      .maybeSingle();
    if (error) throw new Error(`Failed to read notification preferences: ${error.message}`);
    if (preferences && (preferences as Record<string, boolean>)[input.preference] === false) return null;
  }
  const { data, error } = await db.from("notifications").insert({
    recipient_id: input.recipientId,
    actor_id: input.actorId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
    dedupe_key: input.dedupeKey ?? null,
  }).select("*").single();
  if (error?.code === "23505" && input.dedupeKey) {
    const { data: existing, error: lookupError } = await db.from("notifications").select("*").eq("dedupe_key", input.dedupeKey).single();
    if (lookupError) throw new Error(`Failed to resolve duplicate notification: ${lookupError.message}`);
    return existing;
  }
  if (error) throw new Error(`Failed to create notification: ${error.message}`);
  const { error: activityError } = await db.from("activity_logs").insert({
    actor_id: input.actorId ?? null,
    action_type: "notification.generated",
    entity_type: input.entityType ?? "notification",
    entity_id: data.id,
    metadata: { type: input.type, recipient_id: input.recipientId },
  });
  if (activityError) throw new Error(`Failed to log notification activity: ${activityError.message}`);
  return data;
}
