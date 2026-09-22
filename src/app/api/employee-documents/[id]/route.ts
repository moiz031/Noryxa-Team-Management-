import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";

const patchDocSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  file_name: z.string().min(1).max(255).optional(),
  storage_path: z.string().min(1).optional(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  category: z.enum(["employee", "general"]).optional(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: document, error } = await auth.supabase
      .from("employee_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !document) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await auth.supabase
      .storage
      .from("documents")
      .createSignedUrl(document.storage_path, 3600);

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

    const parsed = patchDocSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: getError } = await auth.supabase
      .from("employee_documents")
      .select("*")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let oldStoragePathToRemove: string | null = null;

    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.description !== undefined) updates.description = parsed.data.description;
    if (parsed.data.category !== undefined) updates.category = parsed.data.category;

    if (parsed.data.file_name) {
      updates.file_name = sanitizeFileName(parsed.data.file_name);
    }

    if (parsed.data.storage_path && parsed.data.storage_path !== existing.storage_path) {
      const newPath = parsed.data.storage_path;
      if (!isUserStoragePath(newPath, auth.user.id)) {
        return NextResponse.json({ error: "Storage path must be scoped to your user ID" }, { status: 400 });
      }
      if (!isValidFileSize(parsed.data.file_size)) {
        return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
      }
      if (!isValidMimeType(parsed.data.mime_type)) {
        return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
      }

      const { error: storageError } = await createSupabaseAdminClient().storage
        .from("documents")
        .createSignedUrl(newPath, 60);

      if (storageError) {
        return NextResponse.json({ error: "New file not found in storage" }, { status: 400 });
      }

      updates.storage_path = newPath;
      updates.file_size = parsed.data.file_size ?? null;
      updates.mime_type = parsed.data.mime_type ?? null;
      if (parsed.data.file_name) {
        updates.file_name = sanitizeFileName(parsed.data.file_name);
      }
      updates.version = (existing.version || 1) + 1;
      oldStoragePathToRemove = existing.storage_path;
    }

    const { data: updated, error: updateError } = await auth.supabase
      .from("employee_documents")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update document: " + updateError?.message }, { status: 403 });
    }

    if (oldStoragePathToRemove) {
      await createSupabaseAdminClient()
        .storage
        .from("documents")
        .remove([oldStoragePathToRemove]);
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: oldStoragePathToRemove ? "employee_document.replaced" : "employee_document.renamed",
        entity_type: "employee_document",
        entity_id: id,
        metadata: { updates }
      });

    return NextResponse.json({ document: updated });
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

    const { data: doc, error: getError } = await auth.supabase
      .from("employee_documents")
      .select("storage_path, file_name")
      .eq("id", id)
      .single();

    if (getError || !doc) {
      return NextResponse.json({ error: "Document not found or unauthorized" }, { status: 404 });
    }

    const { error: deleteError } = await auth.supabase
      .from("employee_documents")
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
        action_type: "employee_document.deleted",
        entity_type: "employee_document",
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
