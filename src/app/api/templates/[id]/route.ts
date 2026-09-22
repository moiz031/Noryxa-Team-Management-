import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize, isValidMimeType } from "@/lib/storage/paths";

const patchTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.enum(["template", "general"]).optional(),
  description: z.string().optional().nullable(),
  storage_path: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  mime_type: z.string().optional().nullable(),
  file_size: z.number().int().nonnegative().optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;

    const { data: template, error } = await auth.supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !template) {
      return NextResponse.json({ error: "Template not found or unauthorized" }, { status: 404 });
    }

    let signedUrl: string | null = null;
    if (template.storage_path) {
      const { data: signedUrlData } = await auth.supabase
        .storage
        .from("documents")
        .createSignedUrl(template.storage_path, 3600);
      signedUrl = signedUrlData?.signedUrl ?? null;
    }

    return NextResponse.json({ template, signedUrl });
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

    const parsed = patchTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: existing, error: getError } = await auth.supabase
      .from("templates")
      .select("*")
      .eq("id", id)
      .single();

    if (getError || !existing) {
      return NextResponse.json({ error: "Template not found or unauthorized" }, { status: 404 });
    }

    const updates: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
    let oldStoragePathToRemove: string | null = null;

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
      oldStoragePathToRemove = existing.storage_path;
    }

    const { data: updated, error: updateError } = await auth.supabase
      .from("templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to update template: " + updateError?.message }, { status: 403 });
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
        action_type: oldStoragePathToRemove ? "template.file_replaced" : "template.updated",
        entity_type: "template",
        entity_id: id,
        metadata: { updates }
      });

    return NextResponse.json({ template: updated });
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

    const { data: template, error: getError } = await auth.supabase
      .from("templates")
      .select("name, storage_path")
      .eq("id", id)
      .single();

    if (getError || !template) {
      return NextResponse.json({ error: "Template not found or unauthorized" }, { status: 404 });
    }

    const { error: deleteError } = await auth.supabase
      .from("templates")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }

    if (template.storage_path) {
      await createSupabaseAdminClient()
        .storage
        .from("documents")
        .remove([template.storage_path]);
    }

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "template.deleted",
        entity_type: "template",
        entity_id: id,
        metadata: { name: template.name }
      });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
