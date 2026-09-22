import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getDepartments } from "@/lib/db/departments";
import { listBatch2 } from "@/lib/db/batch2";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import {
  ArrowLeft,
  FolderKanban,
  FileText,
  Building2,
  Calendar,
  Flag,
} from "lucide-react";

type Client = { id: string; name: string };

export default async function NewProjectPage() {
  const context = await requireAdmin();
  const [{ departments }, clients] = await Promise.all([
    getDepartments({ activeOnly: true, pageSize: 100 }),
    listBatch2<Client>("clients"),
  ]);

  async function handleCreate(formData: FormData) {
    "use server";
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const status = formData.get("status") as string;
    const departmentId = formData.get("departmentId") as string;
    const clientId = formData.get("clientId") as string;
    const startsOn = formData.get("startsOn") as string;
    const dueOn = formData.get("dueOn") as string;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name?.trim(),
          description: description?.trim() || undefined,
          status: status || "planning",
          department_id: departmentId || undefined,
          client_id: clientId || undefined,
          starts_on: startsOn || undefined,
          due_on: dueOn || undefined,
        }),
      }
    );

    if (res.ok) {
      redirect("/admin/projects");
    }
  }

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Projects
        </Link>

        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#24C5E3]">
            <FolderKanban className="size-3.5" />
            <span>New Initiative</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Create Project
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Set up a new agency project, assign it to a department, and link a client account.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-6">
          <form action={handleCreate} className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <FolderKanban className="size-3.5" />
                Project Name <span className="text-[#FF4D67]">*</span>
              </label>
              <Input
                name="name"
                type="text"
                required
                placeholder="e.g. NORYXA Brand Refresh"
                autoComplete="off"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <FileText className="size-3.5" />
                Description
              </label>
              <Textarea
                name="description"
                placeholder="Brief scope description, goals, or deliverables…"
                className="min-h-24"
              />
            </div>

            {/* Status + Department row */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <Flag className="size-3.5" />
                  Status
                </label>
                <Select name="status" defaultValue="planning">
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <Building2 className="size-3.5" />
                  Department
                </label>
                <Select name="departmentId" defaultValue="">
                  <option value="">— None —</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Client */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <Building2 className="size-3.5" />
                Client Account
              </label>
              <Select name="clientId" defaultValue="">
                <option value="">— No client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Date range */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <Calendar className="size-3.5" />
                  Start Date
                </label>
                <Input name="startsOn" type="date" />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                  <Calendar className="size-3.5" />
                  Due Date
                </label>
                <Input name="dueOn" type="date" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <Link href="/admin/projects">
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="sm">
                <FolderKanban className="size-3.5" />
                Create Project
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
