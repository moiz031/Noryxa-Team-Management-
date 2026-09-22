import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface OrganizationSettings {
  id: string;
  organization_name: string;
  timezone: string;
  default_work_week: string[];
  default_work_start_time: string;
  default_work_end_time: string;
  max_file_upload_mb: number;
  default_leave_days_per_year: number;
  allow_employee_feed_post: boolean;
  allow_employee_comment: boolean;
  created_at: string;
  updated_at: string;
}

export async function getOrganizationSettings(): Promise<OrganizationSettings | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organization_settings")
    .select("*")
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data as OrganizationSettings;
}

export async function updateOrganizationSettings(
  patch: Partial<Omit<OrganizationSettings, "id" | "created_at" | "updated_at">>
): Promise<OrganizationSettings> {
  const supabase = await createSupabaseServerClient();
  // Get existing row id first
  const { data: existing, error: fetchErr } = await supabase
    .from("organization_settings")
    .select("id")
    .single();
  if (fetchErr || !existing) throw fetchErr ?? new Error("No organization settings row found");

  const { data, error } = await supabase
    .from("organization_settings")
    .update(patch)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as OrganizationSettings;
}
