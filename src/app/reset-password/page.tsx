"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/app/login/page";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter() as { push(path: string): void };
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");

    const { error } = await createSupabaseBrowserClient().auth.updateUser({ password });

    if (error) {
      setMessage(error.message);
      setIsSuccess(false);
    } else {
      setMessage("Password successfully updated. Redirecting to sign in...");
      setIsSuccess(true);
      setTimeout(() => router.push("/login"), 1000);
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Create new password"
      description="Enter a strong new password for your NORYXA account (at least 8 characters)."
    >
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            New password
          </label>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <Button
          className="w-full mt-2"
          size="lg"
          variant="primary"
          disabled={pending}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating credentials...
            </>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>

      {message && (
        <div
          role="status"
          className={`mt-5 flex items-start gap-2.5 rounded-xl border p-3.5 text-xs ${
            isSuccess
              ? "border-[#39FF14]/30 bg-[#39FF14]/10 text-[#39FF14]"
              : "border-[#FF4D67]/30 bg-[#FF4D67]/10 text-[#FF4D67]"
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}
    </AuthCard>
  );
}
