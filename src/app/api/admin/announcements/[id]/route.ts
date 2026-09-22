import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAnnouncementById, updateAnnouncement, deleteAnnouncement } from "@/lib/db/announcements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { announcementSchema } from "@/lib/validation/batch4";
import { notify } from "@/lib/notifications/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const announcement = await getAnnouncementById(id);
    if (!announcement) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    return NextResponse.json({ announcement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = announcementSchema.partial().safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;
    const announcement = await updateAnnouncement({ id, title: body.title, body: body.body, audience: body.audience, department_id: body.departmentId, published_at: body.publishedAt, expires_at: body.expiresAt, is_pinned: body.isPinned, updated_by: admin.user.id });
    const db = createSupabaseAdminClient();
    await db
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "announcement.updated", entity_type: "announcement", entity_id: id, metadata: body });
    if (body.publishedAt) {
      const { data: profiles } = await db.from("profiles").select("id").eq("is_active", true);
      for (const profile of profiles ?? []) await notify({ recipientId: profile.id, actorId: admin.user.id, type: "announcement.updated", title: announcement.title, body: announcement.body.slice(0, 180), entityType: "announcement", entityId: id, preference: "announcement_notifications" });
    }
    return NextResponse.json({ announcement });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    await deleteAnnouncement(id);
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "announcement.deleted", entity_type: "announcement", entity_id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}