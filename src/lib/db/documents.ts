import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Document = {
  id: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  owner_id: string | null;
  department_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  employees?: { id: string; profiles: { full_name: string | null; email: string | null } } | null;
  departments?: { id: string; name: string } | null;
  profiles?: { full_name: string | null; email: string | null } | null;
};

export type DocumentListParams = {
  ownerId?: string | null;
  departmentId?: string | null;
  uploadedBy?: string | null;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getDocuments(params: DocumentListParams = {}): Promise<{ documents: Document[]; total: number }> {
  const supabase = await createSupabaseServerClient();
  const { ownerId, departmentId, uploadedBy, search, page = 1, pageSize = 20 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("documents")
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email)),
      departments!left(id, name),
      profiles!left(full_name, email)`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (ownerId) query = query.eq("owner_id", ownerId);
  if (departmentId) query = query.eq("department_id", departmentId);
  if (uploadedBy) query = query.eq("uploaded_by", uploadedBy);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,file_name.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return { documents: data as Document[], total: count ?? 0 };
}

export async function getDocumentById(id: string): Promise<Document | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email)),
      departments!left(id, name),
      profiles!left(full_name, email)`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch document: ${error.message}`);
  return data as Document | null;
}

export type CreateDocumentInput = {
  title: string;
  description?: string | null;
  storage_path: string;
  file_name: string;
  mime_type?: string | null;
  file_size?: number | null;
  owner_id?: string | null;
  department_id?: string | null;
  uploaded_by: string;
};

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({ ...input, uploaded_by: input.uploaded_by, updated_by: input.uploaded_by })
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email)),
      departments!left(id, name),
      profiles!left(full_name, email)`
    )
    .single();
  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data as Document;
}

export type UpdateDocumentInput = Partial<CreateDocumentInput> & { id: string; updated_by: string };

export async function updateDocument(input: UpdateDocumentInput): Promise<Document> {
  const supabase = await createSupabaseServerClient();
  const { id, updated_by, ...rest } = input;
  const { data, error } = await supabase
    .from("documents")
    .update({ ...rest, updated_by, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(
      `*,
      employees!left(id, profiles!employees_profile_id_fkey(full_name, email)),
      departments!left(id, name),
      profiles!left(full_name, email)`
    )
    .single();
  if (error) throw new Error(`Failed to update document: ${error.message}`);
  return data as Document;
}

export async function deleteDocument(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}