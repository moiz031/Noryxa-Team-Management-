import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Task = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: "backlog" | "todo" | "in_progress" | "blocked" | "review" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  parent_task_id: string | null;
  start_date: string | null;
  due_date: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  projects?: { id: string; name: string; status: string } | null;
  employees?: { id: string; profiles: { full_name: string | null; email: string | null } } | null;
};

export type TaskListParams = {
  status?: "backlog" | "todo" | "in_progress" | "blocked" | "review" | "completed" | "cancelled" | "all";
  projectId?: string | null;
  assignedTo?: string | null;
  priority?: "low" | "medium" | "high" | "urgent" | "all";
  overdue?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getTasks(params: TaskListParams = {}): Promise<{ tasks: Task[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { status = "all", projectId, assignedTo, priority = "all", overdue, search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("tasks")
    .select(
      `*,
      projects!left(id, name, status),
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (projectId) query = query.eq("project_id", projectId);
  if (assignedTo) query = query.eq("assigned_to", assignedTo);
  if (priority !== "all") query = query.eq("priority", priority);
  if (overdue) query = query.lt("due_date", new Date().toISOString().slice(0, 10)).not("status", "in", '("completed","cancelled")');
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
  return { tasks: data as Task[], total: count ?? 0 };
}

export async function getTaskById(id: string): Promise<Task | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
      projects!left(id, name, status),
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch task: ${error.message}`);
  return data as Task | null;
}

export type CreateTaskInput = {
  project_id?: string | null;
  title: string;
  description?: string | null;
  status?: "backlog" | "todo" | "in_progress" | "blocked" | "review" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  assigned_to?: string | null;
  parent_task_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  created_by: string;
};

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      status: input.status ?? "backlog",
      priority: input.priority ?? "medium",
      created_by: input.created_by,
      updated_by: input.created_by,
    })
    .select(
      `*,
      projects!left(id, name, status),
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`
    )
    .single();
  if (error) throw new Error(`Failed to create task: ${error.message}`);
  return data as Task;
}

export type UpdateTaskInput = Partial<CreateTaskInput> & { id: string; updated_by: string };

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const updates: Record<string, unknown> = { ...rest, updated_by, updated_at: new Date().toISOString() };
  if (rest.status === "completed" && !rest.completed_at) {
    updates.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select(
      `*,
      projects!left(id, name, status),
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`
    )
    .single();
  if (error) throw new Error(`Failed to update task: ${error.message}`);
  return data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete task: ${error.message}`);
}