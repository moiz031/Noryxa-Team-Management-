import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/rate-limit";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";

const kbAttachmentSchema = z.object({
  knowledge_base_id: z.string().uuid().optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  storage_path: z.string().min(1),
  file_name: z.string().min(1),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const kbId = url.searchParams.get("knowledgeBaseId");

    let query = auth.supabase.from("knowledge_base_attachments").select("*");
    if (kbId) query = query.eq("knowledge_base_id", kbId);

    const { data: attachments, error } = await query.order("uploaded_at", { ascending: false });
    if (error) throw error;

    return NextResponse.json({ attachments });
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

    const parsed = kbAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(parsed.data.file_name);
    if (!isValidMimeType(parsed.data.mime_type)) {
      return NextResponse.json({ error: "Invalid MIME type" }, { status: 400 });
    }

    if (!isUserStoragePath(parsed.data.storage_path, auth.user.id) || !isValidFileSize(parsed.data.file_size)) {
      return NextResponse.json({ error: "Invalid storage path or file size" }, { status: 400 });
    }

    // Verify file exists in documents bucket
    const { error: storageError } = await createSupabaseAdminClient().storage
      .from("documents")
      .createSignedUrl(parsed.data.storage_path, 60);

    if (storageError) {
      return NextResponse.json({ error: "Uploaded file was not found or is not accessible" }, { status: 400 });
    }

    const { data: attachment, error } = await auth.supabase
      .from("knowledge_base_attachments")
      .insert({
        ...parsed.data,
        file_name: safeFileName,
        uploaded_by: auth.user.id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Unauthorized to add knowledge base attachment: " + error.message }, { status: 403 });
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "kb_attachment.uploaded",
        entity_type: "knowledge_base_attachment",
        entity_id: attachment.id,
        metadata: { file_name: safeFileName }
      });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export const POST = withRateLimit(postHandler, { limit: 12, windowMs: 60_000 });
