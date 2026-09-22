import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, MessageSquare, ArrowRight, Clock } from "lucide-react";

export default async function FeedPage() {
  const context = await requireUser();
  const db = await createSupabaseServerClient();

  const { data: posts } = await db
    .from("feed_posts")
    .select(
      "id,body,team_id,project_id,created_at,profiles!feed_posts_author_id_fkey(full_name,email)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const feedItems = posts ?? [];

  return (
    <AppShell
      role={context.role as "admin" | "employee"}
      userEmail={context.user.email ?? ""}
    >
      <RealtimeRefresh tables={["feed_posts", "feed_comments", "notifications"]} />

      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
              <Users className="size-3.5" />
              <span>Realtime Agency Activity</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Team Feed
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Live internal discussion, status pings, and cross-team project collaboration.
            </p>
          </div>

          <Link
            href="/notifications"
            className="text-xs font-medium text-[#24C5E3] hover:underline"
          >
            Open Inbox →
          </Link>
        </div>

        {/* Posts Stream */}
        {feedItems.length === 0 ? (
          <EmptyState
            icon={<Users className="size-6" />}
            title="Team feed is quiet"
            description="No discussion posts have been published recently. Start a conversation or share an update!"
          />
        ) : (
          <div className="space-y-4">
            {feedItems.map((post) => {
              const authorProfile = Array.isArray(post.profiles)
                ? post.profiles[0]
                : post.profiles;
              const authorName =
                authorProfile?.full_name || authorProfile?.email || "Team member";
              const authorInitial = authorName.charAt(0).toUpperCase();

              return (
                <article
                  key={post.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/85 p-6 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-[#11151C]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#24C5E3]/20 border border-white/10 text-xs font-bold text-[#F5F7FA]">
                        {authorInitial}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F5F7FA]">
                          {authorName}
                        </p>
                        <p className="text-[11px] text-[#6B7280] flex items-center gap-1">
                          <Clock className="size-3" />
                          <span>{new Date(post.created_at).toLocaleString()}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-sm text-[#A7AFBC] whitespace-pre-wrap leading-relaxed">
                    {post.body}
                  </p>

                  <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <Link
                      href={`/feed/${post.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24C5E3] hover:text-[#39FF14] transition-colors"
                    >
                      <MessageSquare className="size-3.5" />
                      <span>View discussion thread</span>
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
