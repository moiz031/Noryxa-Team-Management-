import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Department = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

export type DepartmentListParams = {
  activeOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getDepartments(params: DepartmentListParams | boolean = {}): Promise<{ departments: Department[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const options = typeof params === "boolean" ? { activeOnly: params } : params;
  const { activeOnly = true, search, page = 1, pageSize = 20 } = options;
  const safePage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const safePageSize = Number.isFinite(pageSize) ? Math.min(100, Math.max(1, Math.floor(pageSize))) : 20;
  let query = supabase.from("departments").select("*", { count: "exact" }).order("name", { ascending: true });
  if (activeOnly) query = query.eq("is_active", true);
  if (search?.trim()) {
    const term = search.trim().replace(/[%_,()]/g, "\\$&");
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }
  const { data, error, count } = await query.range((safePage - 1) * safePageSize, safePage * safePageSize - 1);
  if (error) throw new Error(`Failed to fetch departments: ${error.message}`);
  return { departments: data as Department[], total: count ?? 0 };
}

export async function getDepartmentById(id: string): Promise<Department | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("departments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to fetch department: ${error.message}`);
  return data as Department | null;
}

export type CreateDepartmentInput = {
  name: string;
  description?: string | null;
  created_by: string;
};

export async function createDepartment(input: CreateDepartmentInput): Promise<Department> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("departments")
    .insert({ ...input, created_by: input.created_by, updated_by: input.created_by })
    .select("*")
    .single();
  if (error) throw new Error(`Failed to create department: ${error.message}`);
  return data as Department;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & { id: string; updated_by: string };

export async function updateDepartment(input: UpdateDepartmentInput): Promise<Department> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("departments")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`Failed to update department: ${error.message}`);
  return data as Department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete department: ${error.message}`);
}