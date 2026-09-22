import Link from "next/link";
import { AuthCard } from "@/app/login/page";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const messages: Record<string, string> = {
  callback: "The sign-in verification token has expired or is invalid. Please request a fresh access link.",
  missing_profile: "Your account has not been assigned an approved profile yet. Contact an administrator for activation.",
  inactive: "Your account is currently marked inactive. Contact an administrator.",
  invalid_role: "Your account has an invalid role configuration. Please contact your system administrator.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const description =
    messages[code ?? ""] ?? "Authentication could not be completed. Please return to sign in.";

  return (
    <AuthCard
      title="Access Verification Issue"
      description="We encountered an issue verifying your workspace credentials."
    >
      <div className="mt-6 rounded-2xl border border-[#FF4D67]/30 bg-[#FF4D67]/10 p-5 text-xs text-[#FF4D67] flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{description}</p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Link href="/login" className="w-full">
          <Button variant="primary" className="w-full">
            <ArrowLeft className="size-4" />
            Return to Sign In
          </Button>
        </Link>
      </div>
    </AuthCard>
  );
}
