import { requireEmployee } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Megaphone, Pin, Calendar } from "lucide-react";

export default async function AnnouncementsPage() {
  const context = await requireEmployee();
  const db = await createSupabaseServerClient();

  const { data } = await db
    .from("announcements")
    .select("id,title,body,published_at,is_pinned")
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false });

  const announcements = data ?? [];

  return (
    <AppShell
      role="employee"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <Megaphone className="size-3.5" />
            <span>Broadcast Feed</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Agency Announcements
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Company-wide updates, leadership bulletins, and strategic announcements.
          </p>
        </div>

        {/* Announcements List */}
        {announcements.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-6" />}
            title="No announcements published"
            description="There are currently no company-wide announcements in the broadcast stream."
          />
        ) : (
          <div className="space-y-4">
            {announcements.map((item) => (
              <article
                key={item.id}
                className="relative rounded-2xl border border-white/[0.08] bg-[#0E1117]/85 p-6 backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:bg-[#11151C]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    {item.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#39FF14]/30 bg-[#39FF14]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#39FF14]">
                        <Pin className="size-2.5" />
                        Pinned
                      </span>
                    )}
                    <h2 className="text-lg font-bold text-[#F5F7FA]">
                      {item.title}
                    </h2>
                  </div>

                  {item.published_at && (
                    <span className="flex items-center gap-1 text-xs text-[#6B7280]">
                      <Calendar className="size-3" />
                      <span>{new Date(item.published_at).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 text-sm text-[#A7AFBC] leading-relaxed whitespace-pre-wrap">
                  {item.body}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
