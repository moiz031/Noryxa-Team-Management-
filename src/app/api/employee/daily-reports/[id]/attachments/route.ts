import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isScopedStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";
import { withRateLimit } from "@/lib/api/rate-limit";

const reportAttachmentSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable()
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: reportId } = await params;

    // RLS ensures only owner or admin can see attachments
    const { data: attachments, error } = await auth.supabase
      .from("daily_report_attachments")
      .select("*")
      .eq("daily_report_id", reportId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: reportId } = await params;
    const body = await request.json();

    const parsed = reportAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(parsed.data.file_name);
    if (!isValidMimeType(parsed.data.mime_type)) {
      return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
    }

    if (!isScopedStoragePath(parsed.data.storage_path, [auth.user.id, reportId]) || !isValidFileSize(parsed.data.file_size)) {
      return NextResponse.json({ error: "Invalid storage path or file size" }, { status: 400 });
    }

    // Verify file exists in daily-report-attachments storage bucket
    const { error: storageError } = await createSupabaseAdminClient().storage
      .from("daily-report-attachments")
      .createSignedUrl(parsed.data.storage_path, 60);

    if (storageError) {
      return NextResponse.json({ error: "Uploaded file was not found or is not accessible" }, { status: 400 });
    }

    // Insert metadata using user's RLS
    const { data: attachment, error } = await auth.supabase
      .from("daily_report_attachments")
      .insert({
        daily_report_id: reportId,
        storage_path: parsed.data.storage_path,
        file_name: safeFileName,
        mime_type: parsed.data.mime_type ?? null,
        file_size: parsed.data.file_size ?? null,
        uploaded_by: auth.user.id
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Unauthorized to add attachment to this report: " + error.message }, { status: 403 });
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "daily_report.attachment_uploaded",
        entity_type: "daily_report",
        entity_id: reportId,
        metadata: { attachment_id: attachment.id, file_name: safeFileName }
      });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = withRateLimit(postHandler, { limit: 12, windowMs: 60_000 });
