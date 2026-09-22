import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Project = {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  client_id: string | null;
  status: "planning" | "active" | "on_hold" | "completed" | "archived";
  department_id: string | null;
  starts_on: string | null;
  due_on: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  departments?: { id: string; name: string } | null;
  clients?: { id: string; name: string } | null;
};

export type ProjectListParams = {
  status?: "planning" | "active" | "on_hold" | "completed" | "archived" | "all";
  departmentId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getProjects(params: ProjectListParams = {}): Promise<{ projects: Project[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { status = "all", departmentId, search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("projects")
    .select(`*, departments!left(id, name), clients!left(id, name)`, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") query = query.eq("status", status);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (search) query = query.or(`name.ilike.%${search}%,client_name.ilike.%${search}%,description.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
  return { projects: data as Project[], total: count ?? 0 };
}

export async function getProjectById(id: string): Promise<Project | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .select(`*, departments!left(id, name), clients!left(id, name)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch project: ${error.message}`);
  return data as Project | null;
}

export type CreateProjectInput = {
  name: string;
  description?: string | null;
  client_name?: string | null;
  client_id?: string | null;
  status?: "planning" | "active" | "on_hold" | "completed" | "archived";
  department_id?: string | null;
  starts_on?: string | null;
  due_on?: string | null;
  created_by: string;
};

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, status: input.status ?? "planning", created_by: input.created_by, updated_by: input.created_by })
    .select(`*, departments!left(id, name), clients!left(id, name)`)
    .single();
  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export type UpdateProjectInput = Partial<CreateProjectInput> & { id: string; updated_by: string };

export async function updateProject(input: UpdateProjectInput): Promise<Project> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("projects")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, departments!left(id, name), clients!left(id, name)`)
    .single();
  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}