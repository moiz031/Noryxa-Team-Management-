import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit/logger";
import { z } from "zod";

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  category: z.enum(['employee', 'project', 'company', 'sop', 'template', 'knowledge_base', 'general']).optional()
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    
    // RLS handles visibility
    const { data: document, error } = await auth.supabase
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();
      
    if (error || !document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }
    
    // Generate signed URL via admin client because employee might only have read access to the metadata table, 
    // but we can generate a short-lived download URL securely for them.
    // Wait, the storage RLS already protects downloading. 
    // Let's generate it using the user's client so RLS is enforced at the bucket level as well!
    const { data: signedUrlData, error: urlError } = await auth.supabase
      .storage
      .from("documents")
      .createSignedUrl(document.storage_path, 3600); // 1 hour
      
    if (urlError || !signedUrlData) {
      return NextResponse.json({ error: "Unauthorized to access file content" }, { status: 403 });
    }
    
    return NextResponse.json({ document, signedUrl: signedUrlData.signedUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    
    const parsed = updateDocumentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    // Update metadata using user's RLS
    const { data: document, error } = await auth.supabase
      .from("documents")
      .update({
        ...parsed.data,
        updated_by: auth.user.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();
      
    if (error) {
      return NextResponse.json({ error: "Unauthorized or document not found" }, { status: 403 });
    }
    
    await logAuditEvent({
      actorId: auth.user.id,
      event: "document.updated",
      entityType: "document",
      entityId: document.id,
      metadata: { updates: parsed.data },
      request,
    });
      
    return NextResponse.json({ document });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    
    // First retrieve storage path using RLS
    const { data: doc, error: getError } = await auth.supabase
      .from("documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();
      
    if (getError || !doc) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }

    // Delete record (RLS protects this)
    const { error: deleteError } = await auth.supabase
      .from("documents")
      .delete()
      .eq("id", id);
      
    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }
    
    // Now delete the binary from storage using admin client to ensure cleanup, 
    // since we already successfully deleted the RLS-protected metadata row.
    await createSupabaseAdminClient()
      .storage
      .from("documents")
      .remove([doc.storage_path]);
      
    await logAuditEvent({
      actorId: auth.user.id,
      event: "file.deleted",
      entityType: "document",
      entityId: id,
      metadata: { file_name: doc.file_name, storage_path: doc.storage_path },
      request,
    });
      
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
