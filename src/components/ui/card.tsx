import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  hover = true,
  glow = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean; glow?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.08] bg-[#0E1117]/90 p-6 backdrop-blur-sm transition-all duration-200",
        hover && "hover:-translate-y-0.5 hover:border-white/[0.18] hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]",
        glow && "border-[#39FF14]/30 shadow-[0_0_24px_rgba(57,255,20,0.12)]",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 pb-4", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-semibold tracking-tight text-[#F5F7FA]", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-[#A7AFBC] leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center pt-4 border-t border-white/[0.06]", className)}
      {...props}
    />
  );
}
