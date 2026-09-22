"use client";

import Link from "next/link";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/app/login/page";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setIsSuccess(false);

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setPending(false);
      return;
    }

    const { error, data } = await createSupabaseBrowserClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/login`,
      },
    });

    if (error) {
      setMessage(error.message);
      setIsSuccess(false);
    } else if (data.session) {
      setMessage("Account created. You can now sign in.");
      setIsSuccess(true);
    } else {
      setMessage("Check your work email to confirm your account, then sign in.");
      setIsSuccess(true);
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Join NORYXA Agency"
      description="Register your team account. An administrator will verify and activate your workspace access."
    >
      <form onSubmit={register} className="mt-8 space-y-3.5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Full name
          </label>
          <input
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Vance"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Work email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alex@noryxa.com"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Password
          </label>
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Confirm password
          </label>
          <input
            required
            minLength={8}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
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
              Creating account...
            </>
          ) : (
            "Request Workspace Access"
          )}
        </Button>
      </form>

      {message && (
        <div
          role="alert"
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
        Already registered?{" "}
        <Link className="font-semibold text-[#39FF14] hover:underline" href="/login">
          Sign in
        </Link>
      </div>
    </AuthCard>
  );
}
