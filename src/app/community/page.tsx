import { requireUser } from "@/lib/auth/roles";
import { AppShell } from "@/components/layout/app-shell";
import { CommunityFeed } from "@/components/community/community-feed";

export default async function CommunityPage() {
  const context = await requireUser();
  return (
    <AppShell role={context.role as "admin" | "employee"} userEmail={context.user.email ?? ""}>
      <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
        <CommunityFeed />
      </div>
    </AppShell>
  );
}
