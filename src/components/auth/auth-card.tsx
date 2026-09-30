"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center bg-[#07090D] p-4 sm:p-6 noryxa-grid-bg">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-32 size-96 rounded-full bg-[#39FF14]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 size-96 rounded-full bg-[#24C5E3]/5 blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/[0.12] bg-[#0E1117]/95 p-8 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl animate-modal-in">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/noryxa-mark.svg" alt="Noryxa" width={34} height={34} priority className="size-8" />
            <div>
              <Image src="/noryxa-logo.svg" alt="Noryxa Digital Solution" width={156} height={58} priority className="h-10 w-auto object-contain object-left" />
              <span className="block text-[9px] text-[#6B7280]">
                AGENCY OPERATING SYSTEM
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10px] text-[#A7AFBC]">
            <span className="size-1.5 rounded-full bg-[#39FF14] animate-pulse" />
            <span>Secure SSL</span>
          </div>
        </div>

        <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#F5F7FA]">
          {title}
        </h1>
        <p className="mt-1.5 text-xs text-[#A7AFBC] leading-relaxed">
          {description}
        </p>

        {children}
      </div>
    </main>
  );
}
