import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendPositive?: boolean;
  icon?: React.ReactNode;
  accent?: "green" | "cyan" | "purple" | "amber";
  href?: string;
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendPositive = true,
  icon,
  accent = "green",
  href,
  className,
}: StatCardProps) {
  const accentGlow = {
    green: "group-hover:border-[#39FF14]/40 group-hover:shadow-[0_0_24px_rgba(57,255,20,0.12)]",
    cyan: "group-hover:border-[#24C5E3]/40 group-hover:shadow-[0_0_24px_rgba(36,197,227,0.12)]",
    purple: "group-hover:border-[#8B5CF6]/40 group-hover:shadow-[0_0_24px_rgba(139,92,246,0.12)]",
    amber: "group-hover:border-[#F5B942]/40 group-hover:shadow-[0_0_24px_rgba(245,185,66,0.12)]",
  }[accent];

  const iconBg = {
    green: "bg-[#39FF14]/10 text-[#39FF14] border-[#39FF14]/20",
    cyan: "bg-[#24C5E3]/10 text-[#24C5E3] border-[#24C5E3]/20",
    purple: "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20",
    amber: "bg-[#F5B942]/10 text-[#F5B942] border-[#F5B942]/20",
  }[accent];

  const content = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5",
        accentGlow,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#A7AFBC]">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-[#F5F7FA]">
            {value}
          </p>
        </div>
        {icon && (
          <div
            className={cn(
              "grid size-11 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-110",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center font-medium",
                trendPositive ? "text-[#39FF14]" : "text-[#FF4D67]"
              )}
            >
              {trendPositive ? "↑ " : "↓ "}
              {trend}
            </span>
          )}
          {subtitle && <span className="text-[#6B7280]">{subtitle}</span>}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
