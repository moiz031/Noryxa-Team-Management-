import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

const communityPostSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});

export async function GET() {
  try {
    const context = await requireUser();
    const db = await createSupabaseServerClient();
    const { data: posts, error } = await db
      .from("feed_posts")
      .select("id,body,author_id,created_at,profiles!feed_posts_author_id_fkey(full_name,email)")
      .is("team_id", null)
      .is("project_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    const postIds = (posts ?? []).map((post) => post.id);
    const [{ data: comments }, { data: reactions }] = await Promise.all([
      postIds.length
        ? db
            .from("feed_comments")
            .select("id,post_id,body,parent_comment_id,author_id,created_at,profiles!feed_comments_author_id_fkey(full_name,email)")
            .in("post_id", postIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as never[] }),
      postIds.length
        ? db
            .from("reactions")
            .select("entity_id,actor_id,reaction")
            .eq("entity_type", "feed_post")
            .in("entity_id", postIds)
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const responsePosts = (posts ?? []).map((post) => {
      const postComments = (comments ?? []).filter((comment) => comment.post_id === post.id);
      const postReactions = (reactions ?? []).filter((reaction) => reaction.entity_id === post.id);
      const reactionCounts = postReactions.reduce<Record<string, number>>((counts, reaction) => {
        counts[reaction.reaction] = (counts[reaction.reaction] ?? 0) + 1;
        return counts;
      }, {});

      return {
        ...post,
        comments: postComments,
        reactionCounts,
        viewerReactions: postReactions.filter((reaction) => reaction.actor_id === context.user.id).map((reaction) => reaction.reaction),
      };
    });

    return NextResponse.json({ posts: responsePosts, viewerId: context.user.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}

async function postHandler(request: Request) {
  try {
    const context = await requireUser();
    const parsed = communityPostSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const db = await createSupabaseServerClient();
    const { data: post, error } = await db
      .from("feed_posts")
      .insert({ author_id: context.user.id, body: parsed.data.body, team_id: null, project_id: null })
      .select("id,body,author_id,created_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });

    const adminDb = createSupabaseAdminClient();
    const { data: activeEmployees } = await adminDb
      .from("employees")
      .select("profile_id")
      .eq("employment_status", "active")
      .neq("profile_id", context.user.id);

    await Promise.all(
      (activeEmployees ?? []).map((employee) =>
        notify({
          recipientId: employee.profile_id,
          actorId: context.user.id,
          type: "community.post",
          title: "New community post",
          body: post.body.slice(0, 180),
          entityType: "feed_post",
          entityId: post.id,
          dedupeKey: `community-post:${post.id}:${employee.profile_id}`,
        }),
      ),
    );

    await adminDb.rpc("log_activity", {
      p_action_type: "community.post_created",
      p_entity_type: "feed_post",
      p_entity_id: post.id,
      p_metadata: { scope: "community" },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected server error" },
      { status: 500 },
    );
  }
}

export const POST = withRateLimit(postHandler, { limit: 15, windowMs: 60_000 });
