import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { feedCommentSchema } from "@/lib/validation/batch4";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await params;
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("feed_comments").select("*, profiles!feed_comments_author_id_fkey(full_name,email)").eq("post_id", id).order("created_at");
    if (error) throw new Error(error.message);
    return NextResponse.json({ comments: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = feedCommentSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = await createSupabaseServerClient();
    const { data: comment, error } = await db.from("feed_comments").insert({ post_id: id, author_id: user.user.id, ...parsed.data }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    const adminDb = createSupabaseAdminClient();
    const { data: post } = await adminDb.from("feed_posts").select("author_id").eq("id", id).single();
    if (post?.author_id && post.author_id !== user.user.id) await notify({ recipientId: post.author_id, actorId: user.user.id, type: parsed.data.parent_comment_id ? "feed.reply" : "feed.comment", title: parsed.data.parent_comment_id ? "New reply on your update" : "New comment on your update", body: comment.body.slice(0, 180), entityType: "feed_post", entityId: id });
    const mentions = [...comment.body.matchAll(/@([A-Za-z0-9._+-]+)/g)].map((match) => match[1].toLowerCase());
    if (mentions.length) {
      const { data: postContext } = await adminDb.from("feed_posts").select("team_id,project_id").eq("id", id).single();
      const { data: profiles } = await adminDb.from("profiles").select("id,email,full_name").neq("id", user.user.id);
      for (const profile of profiles ?? []) {
        const emailName = profile.email?.split("@")[0]?.toLowerCase();
        const fullName = profile.full_name?.toLowerCase().replace(/\s+/g, ".");
        if (!emailName || (!mentions.includes(emailName) && !mentions.includes(fullName ?? ""))) continue;
        let authorized = false;
        if (postContext?.team_id) {
          const { data } = await adminDb.from("team_members").select("employee_id,employees!inner(profile_id)").eq("team_id", postContext.team_id);
          authorized = (data ?? []).some((row) => (Array.isArray(row.employees) ? row.employees[0] : row.employees)?.profile_id === profile.id);
        }
        if (postContext?.project_id) {
          const { data } = await adminDb.from("project_members").select("employee_id,employees!inner(profile_id)").eq("project_id", postContext.project_id);
          authorized = authorized || (data ?? []).some((row) => (Array.isArray(row.employees) ? row.employees[0] : row.employees)?.profile_id === profile.id);
        }
        if (!authorized) continue;
        const { error: mentionError } = await adminDb.from("mentions").insert({ actor_id: user.user.id, mentioned_profile_id: profile.id, entity_type: "feed_comment", entity_id: comment.id });
        if (!mentionError) await notify({ recipientId: profile.id, actorId: user.user.id, type: "mention", title: "You were mentioned", body: comment.body.slice(0, 180), entityType: "feed_comment", entityId: comment.id, preference: "mention_notifications" });
      }
    }
    await adminDb.rpc("log_activity", { p_action_type: "feed.comment_created", p_entity_type: "feed_comment", p_entity_id: comment.id, p_metadata: { post_id: id, parent_comment_id: parsed.data.parent_comment_id ?? null } });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

// Rate-limited: 30 POST requests per minute per user/IP
export const POST = withRateLimit(postHandler, {
  limit: 30,
  windowMs: 60_000,
});
