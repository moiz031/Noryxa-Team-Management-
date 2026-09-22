import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";

const patchKbAttachmentSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  file_name: z.string().min(1).max(255).optional(),
  storage_path: z.string().min(1).optional(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: attachment, error } = await auth.supabase
      .from("knowledge_base_attachments")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !attachment) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await auth.supabase
      .storage
      .from("documents")
      .createSignedUrl(attachment.storage_path, 3600);

    if (urlError || !signedUrlData) {
      return NextResponse.json({ error: "Unauthorized to access file content" }, { status: 403 });
    }

    return NextResponse.json({ attachment, signedUrl: signedUrlData.signedUrl });
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

    const parsed = patchKbAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: getError } = await auth.supabase
      .from("knowledge_base_attachments")
      .select("*")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let oldStoragePathToRemove: string | null = null;

    if (parsed.data.title !== undefined) updates.title = parsed.data.title;
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
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
      oldStoragePathToRemove = existing.storage_path;
    }

    const { data: updated, error: updateError } = await auth.supabase
      .from("knowledge_base_attachments")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update attachment: " + updateError?.message }, { status: 403 });
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
        action_type: oldStoragePathToRemove ? "kb_attachment.replaced" : "kb_attachment.renamed",
        entity_type: "knowledge_base_attachment",
        entity_id: id,
        metadata: { updates }
      });

    return NextResponse.json({ attachment: updated });
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

    const { data: attachment, error: getError } = await auth.supabase
      .from("knowledge_base_attachments")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (getError || !attachment) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const { error: deleteError } = await auth.supabase
      .from("knowledge_base_attachments")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }

    await createSupabaseAdminClient()
      .storage
      .from("documents")
      .remove([attachment.storage_path]);

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "kb_attachment.deleted",
        entity_type: "knowledge_base_attachment",
        entity_id: id,
        metadata: { path: attachment.storage_path }
      });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
