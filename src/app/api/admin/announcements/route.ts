import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAnnouncements, createAnnouncement } from "@/lib/db/announcements";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { announcementSchema } from "@/lib/validation/batch4";
import { notify } from "@/lib/notifications/engine";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const audience = url.searchParams.get("audience") as "all" | "department" | "all" | null;
    const departmentId = url.searchParams.get("departmentId");
    const publishedOnly = url.searchParams.get("publishedOnly") === "true";
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20");

    const { announcements, total } = await getAnnouncements({
      audience: audience ?? "all",
      departmentId: departmentId ?? undefined,
      publishedOnly,
      page,
      pageSize,
    });

    return NextResponse.json({ announcements, total, page, pageSize });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const parsed = announcementSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const body = parsed.data;
    const announcement = await createAnnouncement({
      title: body.title.trim(),
      body: body.body.trim(),
      audience: body.audience || "all",
      department_id: body.departmentId || null,
      published_at: body.publishedAt || null,
      expires_at: body.expiresAt || null,
      is_pinned: body.isPinned ?? false,
      created_by: admin.user.id,
    });
    const db = createSupabaseAdminClient();
    await db
      .from("activity_logs")
      .insert({ actor_id: admin.user.id, action_type: "announcement.created", entity_type: "announcement", entity_id: announcement.id, metadata: { title: announcement.title } });
    if (announcement.published_at) {
      const { data: profiles } = await db.from("profiles").select("id").eq("is_active", true);
      for (const profile of profiles ?? []) await notify({ recipientId: profile.id, actorId: admin.user.id, type: "announcement.published", title: announcement.title, body: announcement.body.slice(0, 180), entityType: "announcement", entityId: announcement.id, preference: "announcement_notifications" });
    }
    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}