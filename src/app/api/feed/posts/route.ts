import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { feedPostSchema } from "@/lib/validation/batch4";
import { notify } from "@/lib/notifications/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const db = await createSupabaseServerClient();
    let query = db.from("feed_posts").select("*, profiles!feed_posts_author_id_fkey(full_name,email)").order("created_at", { ascending: false }).limit(50);
    if (url.searchParams.get("teamId")) query = query.eq("team_id", url.searchParams.get("teamId")!);
    if (url.searchParams.get("projectId")) query = query.eq("project_id", url.searchParams.get("projectId")!);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ posts: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

async function postHandler(request: Request) {
  try {
    const user = await requireUser();
    const parsed = feedPostSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = await createSupabaseServerClient();
    const { data: post, error } = await db.from("feed_posts").insert({ ...parsed.data, author_id: user.user.id }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    const adminDb = createSupabaseAdminClient();
    const recipients = new Set<string>();
    if (post.team_id) {
      const { data } = await adminDb.from("team_members").select("employees!inner(profile_id)").eq("team_id", post.team_id);
      for (const row of data ?? []) { const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees; if (employee?.profile_id && employee.profile_id !== user.user.id) recipients.add(employee.profile_id); }
    }
    if (post.project_id) {
      const { data } = await adminDb.from("project_members").select("employees!inner(profile_id)").eq("project_id", post.project_id);
      for (const row of data ?? []) { const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees; if (employee?.profile_id && employee.profile_id !== user.user.id) recipients.add(employee.profile_id); }
    }
    for (const recipientId of recipients) await notify({ recipientId, actorId: user.user.id, type: "feed.post", title: "New team update", body: post.body.slice(0, 180), entityType: "feed_post", entityId: post.id, metadata: { team_id: post.team_id, project_id: post.project_id } });
    await adminDb.rpc("log_activity", { p_action_type: "feed.post_created", p_entity_type: "feed_post", p_entity_id: post.id, p_metadata: { team_id: post.team_id, project_id: post.project_id } });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

// Rate-limited: 15 POST requests per minute per user/IP
export const POST = withRateLimit(postHandler, {
  limit: 15,
  windowMs: 60_000,
});
