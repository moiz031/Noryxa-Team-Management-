import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { isUserStoragePath, isValidFileSize } from "@/lib/storage/paths";
import { withRateLimit } from "@/lib/api/rate-limit";

const avatarSchema = z.object({
  storage_path: z.string().min(1),
  file_size: z.number().int().nonnegative().optional().nullable(),
  mime_type: z.string().optional().nullable(),
});

async function postHandler(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    
    const parsed = avatarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    
    // Ensure the storage path actually starts with their ID to prevent hijacking other avatars
    if (!isUserStoragePath(parsed.data.storage_path, auth.user.id)) {
      return NextResponse.json({ error: "Storage path must be scoped to your user ID" }, { status: 400 });
    }

    if (!isValidFileSize(parsed.data.file_size, true)) {
      return NextResponse.json({ error: "Avatar exceeds 5MB size limit" }, { status: 400 });
    }

    if (parsed.data.mime_type && !["image/png", "image/jpeg", "image/webp"].includes(parsed.data.mime_type)) {
      return NextResponse.json({ error: "Invalid avatar image format" }, { status: 400 });
    }

    const { error: storageError } = await createSupabaseAdminClient().storage
      .from("avatars")
      .createSignedUrl(parsed.data.storage_path, 60);
    if (storageError) {
      return NextResponse.json({ error: "Uploaded avatar was not found or is not accessible" }, { status: 400 });
    }
    
    // Fetch current avatar to delete old one if it exists
    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", auth.user.id)
      .single();
      
    const previousAvatar = profile?.avatar_path;
    if (previousAvatar && previousAvatar !== parsed.data.storage_path) {
      // Remove old avatar from bucket
      await createSupabaseAdminClient()
        .storage
        .from("avatars")
        .remove([previousAvatar]);
    }

    // Update profile
    const { error } = await auth.supabase
      .from("profiles")
      .update({ avatar_path: parsed.data.storage_path, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
      
    if (error) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
    
    // Log activity
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "profile.avatar_updated",
        entity_type: "profile",
        entity_id: auth.user.id,
        metadata: { path: parsed.data.storage_path }
      });
      
    return NextResponse.json({ success: true, avatar_path: parsed.data.storage_path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE() {
  try {
    const auth = await requireAuth();
    
    // Fetch current avatar
    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("avatar_path")
      .eq("id", auth.user.id)
      .single();
      
    if (!profile?.avatar_path) {
      return NextResponse.json({ success: true });
    }

    // Remove from bucket
    await createSupabaseAdminClient()
      .storage
      .from("avatars")
      .remove([profile.avatar_path]);

    // Update profile
    const { error } = await auth.supabase
      .from("profiles")
      .update({ avatar_path: null, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
      
    if (error) {
      return NextResponse.json({ error: "Failed to clear avatar from profile" }, { status: 500 });
    }
    
    // Log activity
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "profile.avatar_removed",
        entity_type: "profile",
        entity_id: auth.user.id,
        metadata: { old_path: profile.avatar_path }
      });
      
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// Rate-limited: 10 POST (upload) requests per minute per user/IP – prevent upload abuse
export const POST = withRateLimit(postHandler, {
  limit: 10,
  windowMs: 60_000,
});
