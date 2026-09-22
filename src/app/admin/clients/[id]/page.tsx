import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2 } from "@/lib/db/batch2";
import { getProjects } from "@/lib/db/projects";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  FileText,
  FolderKanban,
  ArrowRight,
} from "lucide-react";

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const [clients, { projects }] = await Promise.all([
    listBatch2<Client>("clients", { id }),
    getProjects({ pageSize: 100 }),
  ]);

  const client = clients[0];
  if (!client) redirect("/admin/clients");

  const linkedProjects = projects.filter((p) => p.client_id === id);

  return (
    <AppShell role="admin" userEmail={""}>
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Clients
        </Link>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.1] bg-gradient-to-r from-[#0E1117] via-[#11151C] to-[#0A0D12] p-6 sm:p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 size-64 rounded-full bg-[#F5B942]/8 blur-[100px] pointer-events-none" />
          <div className="relative z-10 flex items-start gap-5">
            {/* Icon */}
            <div className="shrink-0 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-[#F5B942]/30 to-[#FF4D67]/10 border border-[#F5B942]/20 text-[#F5B942]">
              <Building2 className="size-7" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F5B942]">
                <Building2 className="size-3.5" />
                <span>Client Account</span>
              </div>
              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
                {client.name}
              </h1>

              {/* Contact Info */}
              <div className="mt-3 flex flex-wrap gap-4">
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 text-xs text-[#A7AFBC] hover:text-[#24C5E3] transition-colors"
                  >
                    <Mail className="size-3.5" />
                    {client.email}
                  </a>
                )}
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="flex items-center gap-1.5 text-xs text-[#A7AFBC] hover:text-[#24C5E3] transition-colors"
                  >
                    <Phone className="size-3.5" />
                    {client.phone}
                  </a>
                )}
                {!client.email && !client.phone && (
                  <span className="text-xs text-[#6B7280]">No contact information on file</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Notes Card */}
          {client.notes && (
            <div className="lg:col-span-1 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-[#A7AFBC]" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#6B7280]">
                  Notes
                </h2>
              </div>
              <p className="text-sm text-[#A7AFBC] leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Linked Projects */}
          <div className={`${client.notes ? "lg:col-span-2" : "lg:col-span-3"} rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm overflow-hidden`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <FolderKanban className="size-4 text-[#24C5E3]" />
                <h2 className="text-sm font-semibold text-[#F5F7FA]">Linked Projects</h2>
              </div>
              <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-[#A7AFBC]">
                {linkedProjects.length} project{linkedProjects.length !== 1 ? "s" : ""}
              </span>
            </div>

            {linkedProjects.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<FolderKanban className="size-6" />}
                  title="No linked projects"
                  description="No projects have been associated with this client account yet."
                />
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {linkedProjects.map((proj) => (
                  <Link
                    key={proj.id}
                    href={`/admin/projects/${proj.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-xl bg-white/5 border border-white/10 text-[#24C5E3]">
                        <FolderKanban className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors">
                          {proj.name}
                        </p>
                        {proj.departments?.name && (
                          <p className="text-xs text-[#6B7280] mt-0.5">{proj.departments.name}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={proj.status} />
                      <ArrowRight className="size-3.5 text-[#6B7280] group-hover:text-[#39FF14] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Meta */}
        <p className="text-[11px] text-[#6B7280] px-1">
          Client added:{" "}
          {new Date(client.created_at).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    </AppShell>
  );
}
