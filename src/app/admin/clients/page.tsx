import Link from "next/link";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, ArrowRight, Mail, Phone } from "lucide-react";

export default async function ClientsPage() {
  const context = await requireAdmin();
  const clients = await listBatch2("clients") as {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    status: string;
  }[];

  const statusStyles: Record<string, string> = {
    active: "bg-[#39FF14]/15 text-[#39FF14] border border-[#39FF14]/30",
    inactive: "bg-white/5 text-[#6B7280] border border-white/10",
    prospect: "bg-[#24C5E3]/15 text-[#24C5E3] border border-[#24C5E3]/30",
  };

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
              <Building2 className="size-3.5" />
              <span>Client Directory</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Clients
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Manage client accounts and their contact details.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Total: </span>
            <span className="font-bold text-[#F5F7FA]">{clients.length}</span>
          </div>
        </div>

        {/* Client Cards / Empty State */}
        {clients.length === 0 ? (
          <EmptyState
            icon={<Building2 className="size-6" />}
            title="No clients found"
            description="No client accounts have been registered yet."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => (
              <Link
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#8B5CF6]/30 to-[#24C5E3]/20 text-[#8B5CF6]">
                    <Building2 className="size-5" />
                  </div>
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                      statusStyles[client.status] ?? statusStyles.inactive
                    }`}
                  >
                    {client.status}
                  </span>
                </div>

                <div>
                  <h2 className="font-semibold text-[#F5F7FA] transition-colors group-hover:text-[#39FF14]">
                    {client.name}
                  </h2>
                  {client.email && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-[#6B7280]">
                      <Mail className="size-3" />
                      {client.email}
                    </p>
                  )}
                  {client.phone && (
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-[#6B7280]">
                      <Phone className="size-3" />
                      {client.phone}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-1 text-xs font-medium text-[#24C5E3] transition-colors group-hover:text-[#39FF14]">
                  View details <ArrowRight className="size-3" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
