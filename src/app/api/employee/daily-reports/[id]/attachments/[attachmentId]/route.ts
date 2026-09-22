import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isScopedStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";

const patchReportAttachmentSchema = z.object({
  file_name: z.string().min(1).max(255).optional(),
  storage_path: z.string().min(1).optional(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string, attachmentId: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: reportId, attachmentId } = await params;

    const { data: attachment, error } = await auth.supabase
      .from("daily_report_attachments")
      .select("*")
      .eq("id", attachmentId)
      .eq("daily_report_id", reportId)
      .single();

    if (error || !attachment) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const { data: signedUrlData, error: urlError } = await auth.supabase
      .storage
      .from("daily-report-attachments")
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string, attachmentId: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: reportId, attachmentId } = await params;
    const body = await request.json();

    const parsed = patchReportAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: getError } = await auth.supabase
      .from("daily_report_attachments")
      .select("*")
      .eq("id", attachmentId)
      .eq("daily_report_id", reportId)
      .single();

    if (getError || !existing) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let oldStoragePathToRemove: string | null = null;

    if (parsed.data.file_name) {
      updates.file_name = sanitizeFileName(parsed.data.file_name);
    }

    if (parsed.data.storage_path && parsed.data.storage_path !== existing.storage_path) {
      const newPath = parsed.data.storage_path;
      if (!isScopedStoragePath(newPath, [auth.user.id, reportId])) {
        return NextResponse.json({ error: "Invalid storage path scope" }, { status: 400 });
      }
      if (!isValidFileSize(parsed.data.file_size)) {
        return NextResponse.json({ error: "Invalid file size" }, { status: 400 });
      }
      if (!isValidMimeType(parsed.data.mime_type)) {
        return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
      }

      const { error: storageError } = await createSupabaseAdminClient().storage
        .from("daily-report-attachments")
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
      .from("daily_report_attachments")
      .update(updates)
      .eq("id", attachmentId)
      .eq("daily_report_id", reportId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update attachment: " + updateError?.message }, { status: 403 });
    }

    if (oldStoragePathToRemove) {
      await createSupabaseAdminClient()
        .storage
        .from("daily-report-attachments")
        .remove([oldStoragePathToRemove]);
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: oldStoragePathToRemove ? "daily_report.attachment_replaced" : "daily_report.attachment_renamed",
        entity_type: "daily_report",
        entity_id: reportId,
        metadata: { attachment_id: attachmentId, updates }
      });

    return NextResponse.json({ attachment: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, attachmentId: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: reportId, attachmentId } = await params;

    const { data: attachment, error: getError } = await auth.supabase
      .from("daily_report_attachments")
      .select("storage_path")
      .eq("id", attachmentId)
      .eq("daily_report_id", reportId)
      .single();

    if (getError || !attachment) {
      return NextResponse.json({ error: "Attachment not found or unauthorized" }, { status: 404 });
    }

    const { error: deleteError } = await auth.supabase
      .from("daily_report_attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }

    await createSupabaseAdminClient()
      .storage
      .from("daily-report-attachments")
      .remove([attachment.storage_path]);

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "daily_report.attachment_deleted",
        entity_type: "daily_report",
        entity_id: reportId,
        metadata: { attachment_id: attachmentId, path: attachment.storage_path }
      });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
