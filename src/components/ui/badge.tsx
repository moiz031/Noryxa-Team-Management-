import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
  {
    variants: {
      variant: {
        default: "bg-white/10 text-[#F5F7FA] border border-white/10",
        green: "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30",
        cyan: "bg-[#24C5E3]/10 text-[#24C5E3] border border-[#24C5E3]/30",
        purple: "bg-[#8B5CF6]/10 text-[#8B5CF6] border border-[#8B5CF6]/30",
        amber: "bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942]/30",
        rose: "bg-[#FF4D67]/10 text-[#FF4D67] border border-[#FF4D67]/30",
        slate: "bg-white/5 text-[#A7AFBC] border border-white/5",
      },
      size: {
        sm: "px-2 py-0.2 text-[10px]",
        default: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  pulse?: boolean;
}

export function Badge({
  className,
  variant,
  size,
  dot = false,
  pulse = false,
  children,
  ...props
}: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot && (
        <span
          className={cn(
            "size-1.5 rounded-full bg-current",
            pulse && "animate-pulse"
          )}
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (["active", "completed", "approved", "published", "present"].includes(s)) {
    return (
      <Badge variant="green" dot>
        {status}
      </Badge>
    );
  }
  if (["in_progress", "planning", "review", "reviewed"].includes(s)) {
    return (
      <Badge variant="cyan" dot>
        {status.replace("_", " ")}
      </Badge>
    );
  }
  if (["pending", "on_hold", "draft", "medium"].includes(s)) {
    return (
      <Badge variant="amber" dot>
        {status.replace("_", " ")}
      </Badge>
    );
  }
  if (["urgent", "high", "blocked", "rejected", "suspended", "absent"].includes(s)) {
    return (
      <Badge variant="rose" dot pulse={s === "urgent" || s === "blocked"}>
        {status}
      </Badge>
    );
  }
  return <Badge variant="slate">{status}</Badge>;
}
