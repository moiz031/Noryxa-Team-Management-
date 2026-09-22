import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, isValidMimeType, sanitizeFileName } from "@/lib/storage/paths";

const patchSopSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(["sop", "general"]).optional(),
  version: z.number().int().nonnegative().optional(),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  storage_path: z.string().optional().nullable(),
  file_name: z.string().optional().nullable(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: sop, error } = await auth.supabase
      .from("sops")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !sop) {
      return NextResponse.json({ error: "SOP not found or unauthorized" }, { status: 404 });
    }

    let signedUrl: string | null = null;
    if (sop.storage_path) {
      const { data: signedUrlData } = await auth.supabase
        .storage
        .from("documents")
        .createSignedUrl(sop.storage_path, 3600);
      signedUrl = signedUrlData?.signedUrl ?? null;
    }

    return NextResponse.json({ sop, signedUrl });
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

    const parsed = patchSopSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: getError } = await auth.supabase
      .from("sops")
      .select("*")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return NextResponse.json({ error: "SOP not found or unauthorized" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
    let oldStoragePathToRemove: string | null = null;

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
      updates.version = (existing.version || 1) + 1;
      oldStoragePathToRemove = existing.storage_path;
    }

    const { data: updated, error: updateError } = await auth.supabase
      .from("sops")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update SOP: " + updateError?.message }, { status: 403 });
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
        action_type: oldStoragePathToRemove ? "sop.file_replaced" : "sop.updated",
        entity_type: "sop",
        entity_id: id,
        metadata: { updates }
      });

    return NextResponse.json({ sop: updated });
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

    const { data: sop, error: getError } = await auth.supabase
      .from("sops")
      .select("title, storage_path")
      .eq("id", id)
      .single();

    if (getError || !sop) {
      return NextResponse.json({ error: "SOP not found or unauthorized" }, { status: 404 });
    }

    const { error: deleteError } = await auth.supabase
      .from("sops")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }

    if (sop.storage_path) {
      await createSupabaseAdminClient()
        .storage
        .from("documents")
        .remove([sop.storage_path]);
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "sop.deleted",
        entity_type: "sop",
        entity_id: id,
        metadata: { title: sop.title }
      });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
