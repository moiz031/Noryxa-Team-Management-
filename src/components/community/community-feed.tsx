"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Pin,
  Clock,
  Sparkles,
  MessageSquare,
  MoreHorizontal,
  Search,
  ArrowRight,
  Globe,
  Check,
  Users,
} from "lucide-react";

type Profile = { full_name: string | null; email: string | null } | Array<{ full_name: string | null; email: string | null }> | null;
type Comment = {
  id: string;
  body: string;
  created_at: string;
  profiles: Profile;
};
type CommunityPost = {
  id: string;
  body: string;
  author_id: string;
  created_at: string;
  profiles: Profile;
  comments: Comment[];
  reactionCounts: Record<string, number>;
  viewerReactions: string[];
};

const reactionOptions = [
  { key: "like", label: "Like", icon: Check },
  { key: "celebrate", label: "Celebrate", icon: Sparkles },
  { key: "support", label: "Support", icon: Sparkles },
] as const;

function profileValue(profile: Profile) {
  return Array.isArray(profile) ? profile[0] : profile;
}

function authorName(profile: Profile) {
  const value = profileValue(profile);
  return value?.full_name || value?.email || "Team member";
}

function relativeTime(value: string) {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function CommunityFeed() {
  const [posts, setPosts] = React.useState<CommunityPost[]>([]);
  const [viewerId, setViewerId] = React.useState("");
  const [body, setBody] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<"latest" | "popular" | "mine">("latest");
  const [commentDrafts, setCommentDrafts] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState("");

  const loadPosts = React.useCallback(async () => {
    try {
      const response = await fetch("/api/community/posts", { cache: "no-store" });
      if (!response.ok) throw new Error("Community posts could not be loaded.");
      const data = (await response.json()) as { posts: CommunityPost[]; viewerId?: string };
      setPosts(data.posts ?? []);
      setViewerId(data.viewerId ?? "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Community posts could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => void loadPosts(), 0);
    return () => clearTimeout(timer);
  }, [loadPosts]);

  async function publishPost(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Post could not be published.");
      setBody("");
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post could not be published.");
    } finally {
      setSubmitting(false);
    }
  }

  async function addComment(postId: string) {
    const comment = commentDrafts[postId]?.trim();
    if (!comment) return;
    setBusyKey(`comment:${postId}`);
    try {
      const response = await fetch(`/api/feed/posts/${postId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: comment }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Reply could not be posted.");
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reply could not be posted.");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleReaction(postId: string, reaction: string) {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    const active = post.viewerReactions.includes(reaction);
    setBusyKey(`reaction:${postId}:${reaction}`);
    try {
      const response = await fetch("/api/feed/reactions", {
        method: active ? "DELETE" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entity_type: "feed_post", entity_id: postId, reaction }),
      });
      if (!response.ok) throw new Error((await response.json()).error ?? "Reaction could not be saved.");
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reaction could not be saved.");
    } finally {
      setBusyKey(null);
    }
  }

  async function sharePost(postId: string) {
    const shareUrl = `${window.location.origin}/community#post-${postId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Community link copied.");
    } catch {
      setMessage(shareUrl);
    }
  }

  const visiblePosts = posts
    .filter((post) => !search.trim() || `${post.body} ${authorName(post.profiles)}`.toLowerCase().includes(search.toLowerCase()))
    .filter((post) => sort !== "mine" || post.author_id === viewerId)
    .sort((a, b) => {
      if (sort === "popular") return Object.values(b.reactionCounts).reduce((x, y) => x + y, 0) - Object.values(a.reactionCounts).reduce((x, y) => x + y, 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#24C5E3]/20 bg-gradient-to-br from-[#0E1117] via-[#0E1117] to-[#0C1820] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#24C5E3]"><Users className="size-3.5" /> Open agency community</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[#F5F7FA]">Community</h1>
            <p className="mt-1 max-w-2xl text-sm text-[#A7AFBC]">Share wins, ask questions, exchange working ideas, and learn from the people around you.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B7280]"><span className="size-2 rounded-full bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.8)]" /> Live workspace</div>
        </div>
      </div>

      <form onSubmit={publishPost} className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#24C5E3]/10 text-sm font-bold text-[#24C5E3]">N</div>
          <div className="min-w-0 flex-1">
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} placeholder="Share an update, question, resource, or win with the team..." className="w-full resize-none rounded-xl border border-white/10 bg-[#07090D] px-4 py-3 text-sm text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#24C5E3]/50 focus:ring-2 focus:ring-[#24C5E3]/15" />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-[#6B7280]">Everyone in NORYXA can see and join this conversation.</p>
              <Button type="submit" variant="cyan" size="sm" disabled={submitting || !body.trim()}><ArrowRight className="size-3.5" />{submitting ? "Publishing..." : "Post to community"}</Button>
            </div>
          </div>
        </div>
      </form>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#6B7280]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search community posts..." className="h-10 w-full rounded-xl border border-white/10 bg-[#0E1117] pl-9 pr-3 text-sm text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#24C5E3]/50" /></div>
        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0E1117] p-1">
          {(["latest", "popular", "mine"] as const).map((tab) => <button key={tab} type="button" onClick={() => setSort(tab)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${sort === tab ? "bg-[#24C5E3]/15 text-[#24C5E3]" : "text-[#6B7280] hover:text-white"}`}>{tab === "mine" ? "My posts" : tab}</button>)}
        </div>
      </div>

      {message && <div className="rounded-xl border border-[#24C5E3]/20 bg-[#24C5E3]/10 px-4 py-3 text-xs text-[#24C5E3]">{message}</div>}

      {loading ? <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-white/5 bg-[#0E1117]" />)}</div> : visiblePosts.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 bg-[#0E1117]/60 p-12 text-center"><Users className="mx-auto size-8 text-[#24C5E3]" /><h2 className="mt-3 text-base font-semibold text-[#F5F7FA]">Be the first voice in Community</h2><p className="mx-auto mt-1 max-w-md text-sm text-[#6B7280]">Start with a question, a useful tip, or a small win from today&apos;s work.</p></div> : <div className="space-y-4">
        {visiblePosts.map((post) => {
          const name = authorName(post.profiles);
          const totalReactions = Object.values(post.reactionCounts).reduce((x, y) => x + y, 0);
          return <article id={`post-${post.id}`} key={post.id} className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-4 sm:p-5 transition-colors hover:border-white/15">
            <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#24C5E3]/20 to-[#8B5CF6]/20 text-sm font-bold text-[#F5F7FA]">{name.charAt(0).toUpperCase()}</div><div><p className="text-sm font-semibold text-[#F5F7FA]">{name}</p><p className="mt-0.5 flex items-center gap-1 text-[11px] text-[#6B7280]"><Clock className="size-3" />{relativeTime(post.created_at)}<span>· Open community</span></p></div></div><button type="button" className="rounded-lg p-1.5 text-[#6B7280] hover:bg-white/5 hover:text-white"><MoreHorizontal className="size-4" /></button></div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#D7DCE3]">{post.body}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3"><span className="text-[11px] text-[#6B7280]">{totalReactions} reactions · {post.comments.length} replies</span><span className="flex-1" />{reactionOptions.map(({ key, label, icon: Icon }) => { const active = post.viewerReactions.includes(key); return <button key={key} type="button" onClick={() => void toggleReaction(post.id, key)} disabled={busyKey === `reaction:${post.id}:${key}`} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${active ? "bg-[#24C5E3]/15 text-[#24C5E3]" : "text-[#6B7280] hover:bg-white/5 hover:text-white"}`}><Icon className="size-3.5" />{label}{post.reactionCounts[key] ? ` ${post.reactionCounts[key]}` : ""}</button>})}<button type="button" onClick={() => void sharePost(post.id)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#6B7280] hover:bg-white/5 hover:text-white"><Globe className="size-3.5" />Share</button><button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[#6B7280] hover:bg-white/5 hover:text-white"><Pin className="size-3.5" /></button></div>
            {post.comments.slice(-3).map((comment) => { const commentName = authorName(comment.profiles); return <div key={comment.id} className="mt-3 rounded-xl bg-[#11151C] px-3 py-2.5"><div className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-lg bg-white/5 text-[10px] font-bold text-[#A7AFBC]">{commentName.charAt(0).toUpperCase()}</span><span className="text-xs font-semibold text-[#F5F7FA]">{commentName}</span><span className="text-[10px] text-[#6B7280]">{relativeTime(comment.created_at)}</span></div><p className="mt-1 pl-8 text-xs leading-5 text-[#A7AFBC]">{comment.body}</p></div>})}
            <div className="mt-3 flex items-center gap-2"><MessageSquare className="ml-1 size-4 text-[#6B7280]" /><input value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void addComment(post.id); } }} placeholder="Join the conversation..." className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07090D] px-3 text-xs text-[#F5F7FA] outline-none placeholder:text-[#6B7280] focus:border-[#24C5E3]/50" /><button type="button" onClick={() => void addComment(post.id)} disabled={busyKey === `comment:${post.id}` || !commentDrafts[post.id]?.trim()} className="grid size-9 place-items-center rounded-lg bg-[#24C5E3] text-[#07090D] transition-opacity disabled:opacity-40"><ArrowRight className="size-3.5" /></button></div>
          </article>;
        })}
      </div>}
    </div>
  );
}
