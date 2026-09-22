import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getDepartments } from "@/lib/db/departments";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import {
  Building2,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Layers,
} from "lucide-react";

export default async function DepartmentsPage() {
  const context = await requireAdmin();
  const { departments, total } = await getDepartments({ activeOnly: false, pageSize: 100 });

  async function handleCreate(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/departments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name?.trim(),
          description: description?.trim() || undefined,
        }),
      }
    );

    if (res.ok) {
      redirect("/admin/departments");
    }
  }

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
              <Building2 className="size-3.5" />
              <span>Organization Structure</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
              Departments
            </h1>
            <p className="mt-1 text-xs text-[#A7AFBC]">
              Manage organizational department units, their descriptions, and active status.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#0E1117] px-4 py-2 text-xs">
            <span className="text-[#6B7280]">Total: </span>
            <span className="font-bold text-[#F5F7FA]">{total}</span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Departments List */}
          <div className="lg:col-span-2 space-y-4">
            {departments.length === 0 ? (
              <EmptyState
                icon={<Building2 className="size-6" />}
                title="No departments configured"
                description="Create your first department to start organizing teams and projects."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm divide-y divide-white/[0.05]">
                {departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="group flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Icon */}
                      <div className="shrink-0 grid size-10 place-items-center rounded-xl bg-gradient-to-br from-[#8B5CF6]/20 to-[#24C5E3]/10 border border-white/10 text-[#8B5CF6]">
                        <Layers className="size-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-[#F5F7FA] group-hover:text-[#39FF14] transition-colors truncate">
                            {dept.name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                              dept.is_active
                                ? "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/25"
                                : "bg-white/5 text-[#6B7280] border-white/10"
                            }`}
                          >
                            {dept.is_active ? (
                              <CheckCircle2 className="size-2.5" />
                            ) : (
                              <XCircle className="size-2.5" />
                            )}
                            {dept.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                        {dept.description && (
                          <p className="mt-0.5 text-xs text-[#6B7280] truncate">{dept.description}</p>
                        )}
                        <p className="mt-0.5 text-[10px] text-[#6B7280]">
                          Created{" "}
                          {new Date(dept.created_at).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    <Link
                      href={`/admin/employees?department=${dept.id}`}
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#24C5E3] transition-colors group-hover:text-[#24C5E3]"
                      title="View employees in this department"
                    >
                      <Users className="size-3.5" />
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create Form */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-5 space-y-5 h-fit">
            <div className="flex items-center gap-2">
              <Plus className="size-4 text-[#8B5CF6]" />
              <h2 className="text-sm font-semibold text-[#F5F7FA]">New Department</h2>
            </div>

            <form action={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  Name <span className="text-[#FF4D67]">*</span>
                </label>
                <Input
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Design & UX"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  Description
                </label>
                <Textarea
                  name="description"
                  placeholder="Brief description of this department's function…"
                  className="min-h-20"
                />
              </div>

              <Button type="submit" variant="primary" size="sm" className="w-full">
                <Plus className="size-3.5" />
                Create Department
              </Button>
            </form>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
