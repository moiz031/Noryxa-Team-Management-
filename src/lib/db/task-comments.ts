import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export async function getTaskComments(taskId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("*, profiles!task_comments_author_id_fkey(full_name, email)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`Failed to fetch task comments: ${error.message}`);
  return (data ?? []) as TaskComment[];
}

export async function createTaskComment(taskId: string, authorId: string, body: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({ task_id: taskId, author_id: authorId, body })
    .select("*, profiles!task_comments_author_id_fkey(full_name, email)")
    .single();
  if (error) throw new Error(`Failed to create task comment: ${error.message}`);
  return data as TaskComment;
}

export async function updateTaskComment(id: string, body: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("task_comments").update({ body, updated_by: (await supabase.auth.getUser()).data.user?.id }).eq("id", id)
    .select("*, profiles!task_comments_author_id_fkey(full_name, email)").single();
  if (error) throw new Error(`Failed to update task comment: ${error.message}`);
  return data as TaskComment;
}

export async function deleteTaskComment(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("task_comments").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete task comment: ${error.message}`);
}
