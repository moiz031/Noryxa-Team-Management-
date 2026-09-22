import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Notification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type NotificationListParams = {
  recipientId?: string | null;
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function getNotifications(params: NotificationListParams = {}): Promise<{ notifications: Notification[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { recipientId, unreadOnly = false, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notifications")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (recipientId) query = query.eq("recipient_id", recipientId);
  if (unreadOnly) query = query.is("read_at", null);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
  return { notifications: data as Notification[], total: count ?? 0 };
}

export async function getNotificationById(id: string): Promise<Notification | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("notifications").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to fetch notification: ${error.message}`);
  return data as Notification | null;
}

export async function markNotificationAsRead(id: string, recipientId?: string): Promise<Notification> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("*");
  if (recipientId) query = query.eq("recipient_id", recipientId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
  if (!data) throw new Error("Notification not found");
  return data as Notification;
}

export async function markAllNotificationsAsRead(recipientId: string): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", recipientId)
    .is("read_at", null);
  if (error) throw new Error(`Failed to mark notifications as read: ${error.message}`);
  return count ?? 0;
}

export type CreateNotificationInput = {
  recipient_id: string;
  type: string;
  title: string;
  body?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
};

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert(input)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create notification: ${error.message}`);
  return data as Notification;
}

export async function deleteNotification(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete notification: ${error.message}`);
}
