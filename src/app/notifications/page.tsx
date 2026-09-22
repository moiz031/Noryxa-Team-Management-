import { requireUser } from "@/lib/auth/roles";
import { getNotifications } from "@/lib/db/notifications";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { MarkAllNotificationsReadButton, MarkNotificationReadButton } from "@/components/notification-read-action";
import { Bell, Clock } from "lucide-react";

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function NotificationsPage() {
  const context = await requireUser();
  const { notifications, total } = await getNotifications({
    recipientId: context.user.id,
    pageSize: 50,
  });

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <AppShell
      role={context.role as "admin" | "employee"}
      userEmail={context.user.email ?? ""}
      unreadCount={unreadCount}
    >
      <RealtimeRefresh tables={["notifications"]} />

      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
              <Bell className="size-3.5" />
              <span>Inbox & Alerts</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Notifications
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              {total} total alerts &middot; {unreadCount} unread
            </p>
          </div>

          {unreadCount > 0 && (
            <MarkAllNotificationsReadButton />
          )}
        </div>

        {/* Notifications List */}
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title="All caught up"
            description="You have no notifications in your inbox right now. Everything is up to date."
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((n) => {
              const isUnread = !n.read_at;

              return (
                <article
                  key={n.id}
                  className={`flex items-start gap-4 rounded-2xl border p-5 backdrop-blur-sm transition-all duration-150 ${
                    isUnread
                      ? "border-[#39FF14]/30 bg-[#0E1117] shadow-[0_0_20px_rgba(57,255,20,0.06)]"
                      : "border-white/[0.06] bg-[#0E1117]/60 opacity-75"
                  }`}
                >
                  <div
                    className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                      isUnread
                        ? "bg-[#39FF14] shadow-[0_0_8px_rgba(57,255,20,0.8)] animate-pulse"
                        : "bg-white/20"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <h2
                      className={`text-sm ${
                        isUnread
                          ? "font-bold text-[#F5F7FA]"
                          : "font-medium text-[#A7AFBC]"
                      }`}
                    >
                      {n.title}
                    </h2>

                    {n.body && (
                      <p className="mt-1 text-xs text-[#A7AFBC] line-clamp-2 leading-relaxed">
                        {n.body}
                      </p>
                    )}

                    <p className="mt-2 text-[10px] text-[#6B7280] flex items-center gap-1">
                      <Clock className="size-3" />
                      <span>{formatRelativeTime(n.created_at)}</span>
                    </p>
                    {isUnread && (
                      <div className="mt-3">
                        <MarkNotificationReadButton id={n.id} />
                      </div>
                    )}
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
