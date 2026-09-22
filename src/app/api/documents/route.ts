import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize } from "@/lib/storage/paths";
import { withRateLimit } from "@/lib/api/rate-limit";

const documentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  owner_id: z.string().uuid().optional().nullable(),
  department_id: z.string().uuid().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  category: z.enum(['employee', 'project', 'company', 'sop', 'template', 'knowledge_base', 'general']).default('general')
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const projectId = url.searchParams.get("projectId");
    
    // RLS handles visibility. Just query using user's token.
    let query = auth.supabase.from("documents").select("*");
    if (category) query = query.eq("category", category);
    if (projectId) query = query.eq("project_id", projectId);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    
    return NextResponse.json({ documents: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function postHandler(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    if (!isUserStoragePath(parsed.data.storage_path, auth.user.id) || !isValidFileSize(parsed.data.file_size)) {
      return NextResponse.json({ error: "Invalid storage path or file size" }, { status: 400 });
    }

    const { error: storageError } = await createSupabaseAdminClient().storage
      .from("documents")
      .createSignedUrl(parsed.data.storage_path, 60);
    if (storageError) {
      return NextResponse.json({ error: "Uploaded file was not found or is not accessible" }, { status: 400 });
    }
    
    // Use user's RLS to insert if documents_write policy allows it
    const { data: document, error } = await auth.supabase
      .from("documents")
      .insert({
        ...parsed.data,
        uploaded_by: auth.user.id,
      })
      .select()
      .single();
      
    if (error) throw error;
    
    // Activity log
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "document.uploaded",
        entity_type: "document",
        entity_id: document.id,
        metadata: { category: document.category, file_name: document.file_name }
      });
      
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Rate-limited: 10 file uploads per minute per user/IP
export const POST = withRateLimit(postHandler, { limit: 10, windowMs: 60_000 });
