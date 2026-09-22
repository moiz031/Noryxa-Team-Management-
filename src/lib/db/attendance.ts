import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Attendance = {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: "present" | "late" | "absent" | "half_day" | "remote" | "excused";
  check_in_at: string | null;
  check_out_at: string | null;
  note: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  employees?: { id: string; profiles: { full_name: string | null; email: string | null } } | null;
};

export type AttendanceListParams = {
  employeeId?: string | null;
  status?: "present" | "late" | "absent" | "half_day" | "remote" | "excused" | "all";
  startDate?: string | null;
  endDate?: string | null;
  page?: number;
  pageSize?: number;
};

export async function getAttendance(params: AttendanceListParams = {}): Promise<{ attendance: Attendance[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { employeeId, status = "all", startDate, endDate, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("attendance")
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`,
      { count: "exact" }
    )
    .order("attendance_date", { ascending: false })
    .range(from, to);

  if (employeeId) query = query.eq("employee_id", employeeId);
  if (status !== "all") query = query.eq("status", status);
  if (startDate) query = query.gte("attendance_date", startDate);
  if (endDate) query = query.lte("attendance_date", endDate);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);
  return { attendance: data as Attendance[], total: count ?? 0 };
}

export async function getAttendanceById(id: string): Promise<Attendance | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);
  return data as Attendance | null;
}

export async function getAttendanceByEmployeeAndDate(employeeId: string, attendanceDate: string): Promise<Attendance | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .eq("employee_id", employeeId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch attendance: ${error.message}`);
  return data as Attendance | null;
}

export type CreateAttendanceInput = {
  employee_id: string;
  attendance_date: string;
  status?: "present" | "late" | "absent" | "half_day" | "remote" | "excused";
  check_in_at?: string | null;
  check_out_at?: string | null;
  note?: string | null;
  created_by: string;
};

export async function createAttendance(input: CreateAttendanceInput): Promise<Attendance> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .insert({ ...input, status: input.status ?? "present", created_by: input.created_by, updated_by: input.created_by })
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to create attendance: ${error.message}`);
  return data as Attendance;
}

export type UpdateAttendanceInput = Partial<CreateAttendanceInput> & { id: string; updated_by: string };

export async function updateAttendance(input: UpdateAttendanceInput): Promise<Attendance> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("attendance")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, employees!left(id, profiles!employees_profile_id_fkey(full_name, email))`)
    .single();
  if (error) throw new Error(`Failed to update attendance: ${error.message}`);
  return data as Attendance;
}

export async function deleteAttendance(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete attendance: ${error.message}`);
}