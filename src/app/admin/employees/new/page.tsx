import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/roles";
import { getDepartments } from "@/lib/db/departments";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ArrowLeft, UserPlus, Mail, User, Building2, Briefcase } from "lucide-react";

export default async function NewEmployeePage() {
  const context = await requireAdmin();
  const { departments } = await getDepartments({ activeOnly: true, pageSize: 100 });

  async function handleInvite(formData: FormData) {
    "use server";
    const fullName = formData.get("fullName") as string;
    const email = formData.get("email") as string;
    const jobTitle = formData.get("jobTitle") as string;
    const departmentId = formData.get("departmentId") as string;

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/admin/employees`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName?.trim(),
          email: email?.trim(),
          jobTitle: jobTitle?.trim() || undefined,
          departmentId: departmentId || undefined,
        }),
      }
    );

    if (res.ok) {
      redirect("/admin/employees");
    }
  }

  return (
    <AppShell role="admin" userEmail={context.user.email ?? ""}>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
        {/* Back */}
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A7AFBC] hover:text-white transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Employees
        </Link>

        {/* Header */}
        <div className="border-b border-white/[0.08] pb-6">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#39FF14]">
            <UserPlus className="size-3.5" />
            <span>Team Onboarding</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-[#F5F7FA]">
            Invite Employee
          </h1>
          <p className="mt-1 text-xs text-[#A7AFBC]">
            Send an email invitation to a new team member. The account is created in{" "}
            <span className="text-[#F5B942] font-semibold">pending</span> status until activated.
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0E1117]/80 backdrop-blur-sm p-6 space-y-6">
          <form action={handleInvite} className="space-y-5">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <User className="size-3.5" />
                Full Name <span className="text-[#FF4D67]">*</span>
              </label>
              <Input
                name="fullName"
                type="text"
                required
                placeholder="e.g. Alex Johnson"
                autoComplete="off"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <Mail className="size-3.5" />
                Email Address <span className="text-[#FF4D67]">*</span>
              </label>
              <Input
                name="email"
                type="email"
                required
                placeholder="e.g. alex@noryxa.com"
                autoComplete="off"
              />
            </div>

            {/* Job Title */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <Briefcase className="size-3.5" />
                Job Title
              </label>
              <Input
                name="jobTitle"
                type="text"
                placeholder="e.g. Senior Designer"
                autoComplete="off"
              />
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
                <Building2 className="size-3.5" />
                Department
              </label>
              <Select name="departmentId" defaultValue="">
                <option value="">— No department —</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Info Notice */}
            <div className="rounded-xl border border-[#F5B942]/20 bg-[#F5B942]/5 px-4 py-3 text-xs text-[#F5B942]">
              <span className="font-semibold">Note:</span> The invitee will receive an email link to
              set their password and activate the account. You can activate their employment status
              from their profile page after they sign in.
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.06]">
              <Link href="/admin/employees">
                <Button type="button" variant="secondary" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" size="sm">
                <UserPlus className="size-3.5" />
                Send Invitation
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
