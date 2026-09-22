import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, sanitizeFileName, isValidMimeType } from "@/lib/storage/paths";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/rate-limit";

const companyDocSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  category: z.enum(['company', 'general']).default('company'),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    
    let query = auth.supabase.from("company_documents").select("*");
    if (category) query = query.eq("category", category);
    
    const { data, error } = await query.order('uploaded_at', { ascending: false });
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
    
    const parsed = companyDocSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Sanitize filename and validate MIME type
    const safeFileName = sanitizeFileName(parsed.data.file_name);
    if (!isValidMimeType(parsed.data.mime_type)) {
      return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
    }

    if (!isUserStoragePath(parsed.data.storage_path, auth.user.id) || !isValidFileSize(parsed.data.file_size)) {
      return NextResponse.json({ error: "Invalid storage path or file size" }, { status: 400 });
    }
    
    const { data: document, error } = await auth.supabase
      .from("company_documents")
      .insert({
        ...parsed.data,
        file_name: safeFileName,
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
        action_type: "company_document.uploaded",
        entity_type: "company_document",
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

export const POST = withRateLimit(postHandler, { limit: 12, windowMs: 60_000 });

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }
    
    const { data: doc, error: getError } = await auth.supabase
      .from("company_documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();
    
    if (getError || !doc) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }
    
    const { error: deleteError } = await auth.supabase
      .from("company_documents")
      .delete()
      .eq("id", id);
    
    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }
    
    await createSupabaseAdminClient()
      .storage
      .from("documents")
      .remove([doc.storage_path]);
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "company_document.deleted",
        entity_type: "company_document",
        entity_id: id,
        metadata: { file_name: doc.file_name }
      });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
