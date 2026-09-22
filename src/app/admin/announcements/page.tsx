import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { getAnnouncements } from "@/lib/db/announcements";
import { QuickForm } from "@/components/quick-form";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Megaphone, Pin, Calendar, Plus } from "lucide-react";

export default async function AdminAnnouncementsPage() {
  const context = await requireAdmin();
  const { announcements } = await getAnnouncements({ pageSize: 100 });

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <Megaphone className="size-3.5" />
            <span>Broadcast Center</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Announcements
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Publish agency-wide broadcasts, pinned notices, and team updates.
          </p>
        </div>

        {/* Create Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-6">
          <div className="mb-5 flex items-center gap-2">
            <Plus className="size-4 text-[#39FF14]" />
            <h2 className="text-sm font-semibold text-[#F5F7FA]">New Announcement</h2>
          </div>
          <QuickForm
            endpoint="/api/admin/announcements"
            fields={[
              { name: "title", label: "Title" },
              { name: "body", label: "Message", multiline: true },
            ]}
            submitLabel="Publish Announcement"
          />
        </div>

        {/* Announcements List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#A7AFBC] uppercase tracking-wider">
              Published Announcements
            </h2>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-0.5 text-xs text-[#6B7280]">
              {announcements.length} total
            </span>
          </div>

          {announcements.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="size-6" />}
              title="No announcements"
              description="No announcements have been published yet."
            />
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <article
                  key={announcement.id}
                  className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 transition-all duration-150 hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {announcement.is_pinned && (
                          <Pin className="size-3.5 text-[#F5B942] shrink-0" />
                        )}
                        <h3 className="truncate font-semibold text-[#F5F7FA]">
                          {announcement.title}
                        </h3>
                      </div>
                      <p className="mt-2 text-xs text-[#A7AFBC] leading-relaxed line-clamp-3">
                        {announcement.body}
                      </p>
                      {announcement.published_at && (
                        <p className="mt-3 flex items-center gap-1 text-[11px] text-[#6B7280]">
                          <Calendar className="size-3" />
                          {new Date(announcement.published_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        announcement.published_at
                          ? "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30"
                          : "bg-white/5 text-[#6B7280] border border-white/10"
                      }`}
                    >
                      {announcement.published_at ? "Published" : "Draft"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
