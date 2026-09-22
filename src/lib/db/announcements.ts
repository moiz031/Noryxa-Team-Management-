import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "department";
  department_id: string | null;
  published_at: string | null;
  expires_at: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string | null;
  departments?: { id: string; name: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export type AnnouncementListParams = {
  audience?: "all" | "department" | "all";
  departmentId?: string | null;
  publishedOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function getAnnouncements(params: AnnouncementListParams = {}): Promise<{ announcements: Announcement[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { audience = "all", departmentId, publishedOnly = false, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("announcements")
    .select(`*, departments!left(id, name), profiles!left(full_name, email)`, { count: "exact" })
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (audience !== "all") query = query.eq("audience", audience);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (publishedOnly) {
    const now = new Date().toISOString();
    query = query.lte("published_at", now).or(`expires_at.is.null,expires_at.gte.${now}`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch announcements: ${error.message}`);
  return { announcements: data as Announcement[], total: count ?? 0 };
}

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(`*, departments!left(id, name), profiles!left(full_name, email)`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch announcement: ${error.message}`);
  return data as Announcement | null;
}

export type CreateAnnouncementInput = {
  title: string;
  body: string;
  audience?: "all" | "department";
  department_id?: string | null;
  published_at?: string | null;
  expires_at?: string | null;
  is_pinned?: boolean;
  created_by: string;
};

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .insert({
      ...input,
      audience: input.audience ?? "all",
      is_pinned: input.is_pinned ?? false,
      created_by: input.created_by,
      updated_by: input.created_by,
    })
    .select(`*, departments!left(id, name), profiles!left(full_name, email)`)
    .single();
  if (error) throw new Error(`Failed to create announcement: ${error.message}`);
  return data as Announcement;
}

export type UpdateAnnouncementInput = Partial<CreateAnnouncementInput> & { id: string; updated_by: string };

export async function updateAnnouncement(input: UpdateAnnouncementInput): Promise<Announcement> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("announcements")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(`*, departments!left(id, name), profiles!left(full_name, email)`)
    .single();
  if (error) throw new Error(`Failed to update announcement: ${error.message}`);
  return data as Announcement;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete announcement: ${error.message}`);
}