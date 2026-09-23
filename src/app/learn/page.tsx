import { requireUser } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import { LearningLibrary } from "@/components/learning/learning-library";

export default async function LearnPage() {
  const context = await requireUser();
  return (
    <AppShell role={context.role as "admin" | "employee"} userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
        <LearningLibrary />
      </div>
    </AppShell>
  );
}
