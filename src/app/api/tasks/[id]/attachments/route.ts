import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isScopedStoragePath, isValidFileSize, sanitizeFileName, isValidMimeType } from "@/lib/storage/paths";
import { withRateLimit } from "@/lib/api/rate-limit";

const attachmentSchema = z.object({
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable()
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id: taskId } = await params;
    
    // RLS will ensure user only sees attachments for tasks they can access
    const { data: attachments, error } = await auth.supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order('created_at', { ascending: false });
      
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
    const { id: taskId } = await params;
    const body = await request.json();
    
    const parsed = attachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(parsed.data.file_name);
    if (!isValidMimeType(parsed.data.mime_type)) {
      return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
    }

    if (!isScopedStoragePath(parsed.data.storage_path, [auth.user.id, taskId]) || !isValidFileSize(parsed.data.file_size)) {
      return NextResponse.json({ error: "Invalid storage path or file size" }, { status: 400 });
    }

    const { error: storageError } = await createSupabaseAdminClient().storage
      .from("task-attachments")
      .createSignedUrl(parsed.data.storage_path, 60);
    if (storageError) {
      return NextResponse.json({ error: "Uploaded file was not found or is not accessible" }, { status: 400 });
    }
    
    // Validate if the user has access to the task before inserting metadata
    // Wait, the insert policy for task_attachments in RLS enforces this! 
    // We just try to insert using user's RLS.
    const { data: attachment, error } = await auth.supabase
      .from("task_attachments")
      .insert({
        task_id: taskId,
        ...parsed.data,
        file_name: safeFileName,
        uploaded_by: auth.user.id
      })
      .select()
      .single();
      
    if (error) {
      return NextResponse.json({ error: "Unauthorized to add attachment to this task" }, { status: 403 });
    }
    
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "task.attachment_uploaded",
        entity_type: "task",
        entity_id: taskId,
        metadata: { attachment_id: attachment.id, file_name: attachment.file_name }
      });
      
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = withRateLimit(postHandler, { limit: 12, windowMs: 60_000 });
