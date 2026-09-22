import { requireAdmin } from "@/lib/auth/roles";
import { getProjects } from "@/lib/db/projects";
import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { FolderKanban, Plus, Building2, ArrowRight } from "lucide-react";

async function ProjectsTable() {
  const { projects } = await getProjects({ pageSize: 50 });

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban className="size-6" />}
        title="No projects configured"
        description="No agency projects have been registered in the database yet."
        action={
          <Link href="/admin/projects/new">
            <Button variant="primary" size="sm">
              <Plus className="size-3.5" />
              Create First Project
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-white/[0.08] bg-white/[0.02] text-[#6B7280] uppercase tracking-wider">
          <tr>
            <th className="px-5 py-3.5">Project Name</th>
            <th className="px-5 py-3.5">Department</th>
            <th className="px-5 py-3.5">Status</th>
            <th className="px-5 py-3.5">Client</th>
            <th className="px-5 py-3.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {projects.map((proj) => (
            <tr key={proj.id} className="hover:bg-white/[0.02] transition-colors group">
              <td className="px-5 py-4 font-semibold text-[#F5F7FA]">
                <Link
                  href={`/admin/projects/${proj.id}`}
                  className="hover:text-[#39FF14] transition-colors flex items-center gap-2"
                >
                  <FolderKanban className="size-4 text-[#24C5E3]" />
                  <span>{proj.name}</span>
                </Link>
              </td>
              <td className="px-5 py-4 text-[#A7AFBC]">
                {proj.departments?.name || "—"}
              </td>
              <td className="px-5 py-4">
                <StatusBadge status={proj.status} />
              </td>
              <td className="px-5 py-4 text-[#A7AFBC]">
                {proj.client_name ? (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-[#6B7280]" />
                    <span>{proj.client_name}</span>
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-5 py-4 text-right">
                <Link
                  href={`/admin/projects/${proj.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#24C5E3] hover:text-[#39FF14] transition-colors"
                >
                  <span>Manage</span>
                  <ArrowRight className="size-3" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminProjectsPage() {
  const context = await requireAdmin();

  return (
    <AppShell
      role="admin"
      userEmail={context.user.email ?? ""}
    >
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
              <FolderKanban className="size-3.5" />
              <span>Initiatives Directory</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Project Management
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Configure agency projects, client scopes, and member role allocations.
            </p>
          </div>

          <Link href="/admin/projects/new">
            <Button size="sm" variant="primary">
              <Plus className="size-3.5" />
              Create Project
            </Button>
          </Link>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 p-4 backdrop-blur-sm">
          <select
            defaultValue="all"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 text-xs text-[#F5F7FA] focus:border-[#39FF14]/50 focus:outline-none"
          >
            <option value="all">All Project Statuses</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>

          <select
            defaultValue=""
            className="h-10 rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 text-xs text-[#F5F7FA] focus:border-[#39FF14]/50 focus:outline-none"
          >
            <option value="">All Departments</option>
          </select>
        </div>

        {/* Table */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-16 text-sm text-[#A7AFBC]">
              <div className="size-5 animate-spin rounded-full border-2 border-[#39FF14] border-t-transparent mr-3" />
              Loading project matrix...
            </div>
          }
        >
          <ProjectsTable />
        </Suspense>
      </div>
    </AppShell>
  );
}