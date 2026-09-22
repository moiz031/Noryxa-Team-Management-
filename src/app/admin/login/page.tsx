"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/app/login/page";
import { Shield, Loader2, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter() as { push(path: string): void };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");

    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else {
      const { data } = await supabase
        .from("profiles")
        .select("roles!inner(code)")
        .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .single();

      const roleValue = data?.roles as unknown as { code?: string } | { code?: string }[] | null;
      const role = Array.isArray(roleValue) ? roleValue[0]?.code : roleValue?.code;

      if (role !== "admin") {
        await supabase.auth.signOut();
        setMessage("Administrator privileges are required to access this console.");
      } else {
        router.push("/admin");
      }
    }
    setPending(false);
  }

  return (
    <AuthCard
      title="Admin Command Console"
      description="Restricted executive portal. Verify your administrator authorization to continue."
    >
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#39FF14]/20 bg-[#39FF14]/5 p-3 text-xs text-[#39FF14]">
        <Shield className="size-4 shrink-0" />
        <span>Elevated administrative security active.</span>
      </div>

      <form onSubmit={signIn} className="mt-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
            Admin email
          </label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@noryxa.com"
            className="mt-2 h-11 w-full rounded-xl border border-white/[0.1] bg-[#11151C] px-3.5 py-2 text-sm text-[#F5F7FA] placeholder-[#6B7280] shadow-inner transition-colors duration-150 focus:border-[#39FF14]/50 focus:outline-none focus:ring-2 focus:ring-[#39FF14]/20"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#A7AFBC]">
              Admin password
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
            onChange={(e) => setPassword(e.target.value)}
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
              Verifying Authorization...
            </>
          ) : (
            "Access Admin Console"
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

      <div className="mt-6 border-t border-white/[0.08] pt-5 text-center text-xs text-[#A7AFBC]">
        <Link className="hover:text-white transition-colors" href="/login">
          ← Return to Employee sign in
        </Link>
      </div>
    </AuthCard>
  );
}
