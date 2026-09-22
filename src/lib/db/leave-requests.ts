import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LeaveRequest = {
  id: string;
  employee_id: string;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  employees?: { id: string; profiles: { full_name: string | null; email: string | null } } | null;
};

export type LeaveRequestListParams = {
  employeeId?: string | null;
  status?: "pending" | "approved" | "rejected" | "cancelled" | "all";
  page?: number;
  pageSize?: number;
};

export async function getLeaveRequests(params: LeaveRequestListParams = {}): Promise<{ leaveRequests: LeaveRequest[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { employeeId, status = "all", page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leave_requests")
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch leave requests: ${error.message}`);
  return { leaveRequests: data as LeaveRequest[], total: count ?? 0 };
}

export async function getLeaveRequestById(id: string): Promise<LeaveRequest | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch leave request: ${error.message}`);
  return data as LeaveRequest | null;
}

export type CreateLeaveRequestInput = {
  employee_id: string;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  reason?: string | null;
  status?: "pending" | "approved" | "rejected" | "cancelled";
  created_by: string;
};

export async function createLeaveRequest(input: CreateLeaveRequestInput): Promise<LeaveRequest> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({ ...input, status: input.status ?? "pending", created_by: input.created_by, updated_by: input.created_by })
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to create leave request: ${error.message}`);
  return data as LeaveRequest;
}

export type UpdateLeaveRequestInput = Partial<CreateLeaveRequestInput> & { id: string; updated_by: string };

export async function updateLeaveRequest(input: UpdateLeaveRequestInput): Promise<LeaveRequest> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("leave_requests")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to update leave request: ${error.message}`);
  return data as LeaveRequest;
}

export async function deleteLeaveRequest(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("leave_requests").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete leave request: ${error.message}`);
}