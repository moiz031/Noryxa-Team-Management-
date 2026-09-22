"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/app/login/page";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage("");

    const { error } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      }
    );

    if (error) {
      setMessage(error.message);
      setIsSuccess(false);
    } else {
      setMessage("If an account exists, a secure password reset link has been dispatched.");
      setIsSuccess(true);
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your registered agency email and we will send a password reset verification link."
    >
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Work email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@noryxa.com"
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
              Dispatching Link...
            </>
          ) : (
            "Send Reset Link"
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

      <div className="mt-6 border-t border-white/[0.08] pt-5 text-center text-xs text-[#A7AFBC]">
        <Link className="hover:text-white transition-colors" href="/login">
          ← Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
