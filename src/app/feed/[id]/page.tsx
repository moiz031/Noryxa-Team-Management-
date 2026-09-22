import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { MessageSquare, ArrowLeft, Clock } from "lucide-react";

export default async function FeedPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireUser();
  const { id } = await params;
  const db = await createSupabaseServerClient();

  const [{ data: post }, { data: comments }] = await Promise.all([
    db
      .from("feed_posts")
      .select(
        "id,body,created_at,profiles!feed_posts_author_id_fkey(full_name,email)"
      )
      .eq("id", id)
      .maybeSingle(),
    db
      .from("feed_comments")
      .select(
        "id,body,parent_comment_id,created_at,profiles!feed_comments_author_id_fkey(full_name,email)"
      )
      .eq("post_id", id)
      .order("created_at"),
  ]);

  if (!post) redirect("/feed");

  const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
  const authorName = author?.full_name || author?.email || "Team member";
  const authorInitial = authorName.charAt(0).toUpperCase();
  const commentList = comments ?? [];

  return (
    <AppShell
      role={context.role as "admin" | "employee"}
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Team Feed</span>
        </Link>

        {/* Main Post Card */}
        <article className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#24C5E3]/20 border border-white/10 text-sm font-bold text-[#F5F7FA]">
              {authorInitial}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#F5F7FA]">{authorName}</p>
              <p className="text-xs text-[#6B7280] flex items-center gap-1">
                <Clock className="size-3" />
                <span>{new Date(post.created_at).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm sm:text-base text-[#F5F7FA] whitespace-pre-wrap leading-relaxed">
            {post.body}
          </p>
        </article>

        {/* Comments Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="size-4 text-[#24C5E3]" />
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Discussion ({commentList.length})
            </h2>
          </div>

          {commentList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] p-6 text-center text-xs text-[#6B7280]">
              No replies to this post yet.
            </div>
          ) : (
            <div className="space-y-3">
              {commentList.map((comment) => {
                const commentAuthor = Array.isArray(comment.profiles)
                  ? comment.profiles[0]
                  : comment.profiles;
                const cName =
                  commentAuthor?.full_name || commentAuthor?.email || "Team member";
                const cInitial = cName.charAt(0).toUpperCase();

                return (
                  <article
                    key={comment.id}
                    className="rounded-2xl border border-white/[0.06] bg-[#0E1117]/60 p-4 pl-5 ml-4 sm:ml-8"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-7 place-items-center rounded-lg bg-white/5 border border-white/10 text-[11px] font-bold text-[#A7AFBC]">
                        {cInitial}
                      </div>
                      <p className="text-xs font-semibold text-[#F5F7FA]">{cName}</p>
                      <span className="text-[10px] text-[#6B7280]">
                        {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="mt-2 text-xs sm:text-sm text-[#A7AFBC] leading-relaxed">
                      {comment.body}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
