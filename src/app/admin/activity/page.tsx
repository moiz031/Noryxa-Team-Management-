import { requireAdmin } from "@/lib/auth/roles";
import { getActivityLogs } from "@/lib/db/activity-logs";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity, Clock, ShieldCheck } from "lucide-react";

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function ActivityAuditPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const context = await requireAdmin();
  const params = (await searchParams) ?? {};
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { logs, total } = await getActivityLogs({ page, pageSize: 50 });

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <Activity className="size-3.5" />
            <span>Forensic Operations</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">Activity Audit</h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Append-only business and security events. Historical entries cannot be edited from this screen.
          </p>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-6" />}
            title="No activity recorded"
            description="Audited mutations will appear here as the team operates the workspace."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1117]/85">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 text-xs text-[#A7AFBC]">
              <span>{total.toLocaleString()} total events</span>
              <span>Page {page}</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {logs.map((log) => (
                <article key={log.id} className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#39FF14]/20 bg-[#39FF14]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#39FF14]">
                        {log.action_type}
                      </span>
                      {log.entity_type && <span className="text-xs text-[#24C5E3]">{log.entity_type}</span>}
                      {log.entity_id && <span className="truncate font-mono text-[10px] text-[#6B7280]">{log.entity_id}</span>}
                    </div>
                    {Object.keys(log.metadata ?? {}).length > 0 && (
                      <pre className="mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-[#A7AFBC]">
                        {JSON.stringify(log.metadata)}
                      </pre>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-xs text-[#6B7280] md:justify-end">
                    <Clock className="mt-0.5 size-3.5 shrink-0" />
                    <span>{formatDate(log.created_at)}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
