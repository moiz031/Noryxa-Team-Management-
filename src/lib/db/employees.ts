import { createSupabaseServerClient } from "@/lib/supabase/server";

export type EmployeeWithProfile = {
  id: string;
  profile_id: string;
  employee_code: string | null;
  department_id: string | null;
  manager_id: string | null;
  job_title: string | null;
  joined_on: string | null;
  employment_status: "pending" | "active" | "suspended" | "inactive";
  emergency_contact: Record<string, unknown> | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  profiles: {
    id: string;
    role_id: string;
    full_name: string | null;
    avatar_path: string | null;
    phone: string | null;
    timezone: string;
    is_active: boolean;
    email: string | null;
    created_at: string;
    updated_at: string;
    roles?: { id: string; code: "admin" | "employee"; name: string } | null;
  };
  departments: { id: string; name: string } | null;
};

export type EmployeeListParams = {
  status?: "pending" | "active" | "suspended" | "inactive" | "all";
  departmentId?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getEmployees(params: EmployeeListParams = {}): Promise<{
  employees: EmployeeWithProfile[];
  total: number;
}> {
  const supabase = await createSupabaseServerClient();
  const { status = "all", departmentId, search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("employees")
    .select(
      `*,
      profiles!employees_profile_id_fkey(id, role_id, full_name, avatar_path, phone, timezone, is_active, email, created_at, updated_at, roles!left(id, code, name)),
      departments!left(id, name)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") {
    query = query.eq("employment_status", status);
  }
  if (departmentId) {
    query = query.eq("department_id", departmentId);
  }
  if (search) {
    query = query.or(
      `profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%,employee_code.ilike.%${search}%,job_title.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch employees: ${error.message}`);
  return { employees: data as EmployeeWithProfile[], total: count ?? 0 };
}

export async function getEmployeeById(id: string): Promise<EmployeeWithProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      `*,
      profiles!employees_profile_id_fkey(id, role_id, full_name, avatar_path, phone, timezone, is_active, email, created_at, updated_at, roles!left(id, code, name)),
      departments!left(id, name)`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch employee: ${error.message}`);
  return data as EmployeeWithProfile | null;
}

export async function getEmployeeByProfileId(profileId: string): Promise<EmployeeWithProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      `*,
      profiles!employees_profile_id_fkey(id, role_id, full_name, avatar_path, phone, timezone, is_active, email, created_at, updated_at, roles!left(id, code, name)),
      departments!left(id, name)`
    )
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch employee: ${error.message}`);
  return data as EmployeeWithProfile | null;
}

export type CreateEmployeeInput = {
  profile_id: string;
  employee_code?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
  job_title?: string | null;
  joined_on?: string | null;
  employment_status?: "pending" | "active" | "suspended" | "inactive";
  emergency_contact?: Record<string, unknown> | null;
  created_by: string;
};

export async function createEmployee(input: CreateEmployeeInput): Promise<EmployeeWithProfile> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({
      ...input,
      employment_status: input.employment_status ?? "pending",
      created_by: input.created_by,
      updated_by: input.created_by,
    })
    .select(
      `*,
      profiles!employees_profile_id_fkey(id, role_id, full_name, avatar_path, phone, timezone, is_active, email, created_at, updated_at, roles!left(id, code, name)),
      departments!left(id, name)`
    )
    .single();
  if (error) throw new Error(`Failed to create employee: ${error.message}`);
  return data as EmployeeWithProfile;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & { id: string; updated_by: string };

export async function updateEmployee(input: UpdateEmployeeInput): Promise<EmployeeWithProfile> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("employees")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      `*,
      profiles!employees_profile_id_fkey(id, role_id, full_name, avatar_path, phone, timezone, is_active, email, created_at, updated_at, roles!left(id, code, name)),
      departments!left(id, name)`
    )
    .single();
  if (error) throw new Error(`Failed to update employee: ${error.message}`);
  return data as EmployeeWithProfile;
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("employees").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete employee: ${error.message}`);
}