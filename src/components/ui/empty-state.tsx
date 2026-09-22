import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0E1117]/60 p-8 text-center backdrop-blur-sm",
        className
      )}
    >
      {icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-white/10 bg-[#11151C] text-[#24C5E3] shadow-[0_0_20px_rgba(36,197,227,0.1)]">
          {icon}
        </div>
      )}
      <h4 className="text-base font-semibold text-[#F5F7FA]">{title}</h4>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#A7AFBC]">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
