"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";

export default function LoginPage() {
  const router = useRouter() as { push(path: string): void };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const { error } = await createSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
    } else {
      router.push("/dashboard");
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to your NORYXA command center with your agency credentials."
    >
      <form onSubmit={signIn} className="mt-8 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Work email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@noryxa.com"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
              Password
            </label>
            <Link
              className="text-xs text-[#24C5E3] hover:underline"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
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
              Authenticating...
            </>
          ) : (
            "Sign in to Command Center"
          )}
        </Button>
      </form>

      {message && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-xl border border-[#FF4D67]/30 bg-[#FF4D67]/10 p-3.5 text-xs text-[#FF4D67]"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <div className="mt-6 border-t border-white/[0.08] pt-5 flex items-center justify-between text-xs text-[#A7AFBC]">
        <span>New agency member?</span>
        <Link
          className="font-medium text-[#39FF14] hover:underline"
          href="/register"
        >
          Request account access
        </Link>
      </div>
    </AuthCard>
  );
}

