import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39FF14]/50 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[#39FF14] text-[#07090D] font-semibold hover:bg-[#32E612] hover:shadow-[0_0_20px_rgba(57,255,20,0.35)]",
        primary:
          "bg-[#39FF14] text-[#07090D] font-semibold hover:bg-[#32E612] hover:shadow-[0_0_20px_rgba(57,255,20,0.35)] animate-light-sweep",
        cyan:
          "bg-[#24C5E3] text-[#07090D] font-semibold hover:bg-[#1fb3ce] hover:shadow-[0_0_20px_rgba(36,197,227,0.35)]",
        secondary:
          "bg-[#11151C] text-[#F5F7FA] border border-white/10 hover:bg-[#151A22] hover:border-white/20 hover:text-white",
        outline:
          "bg-transparent text-[#A7AFBC] border border-white/10 hover:text-white hover:bg-white/5 hover:border-white/20",
        ghost:
          "bg-transparent text-[#A7AFBC] hover:text-white hover:bg-white/5",
        danger:
          "bg-[#FF4D67]/10 text-[#FF4D67] border border-[#FF4D67]/30 hover:bg-[#FF4D67]/20 hover:border-[#FF4D67]/50",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-lg",
        lg: "h-12 px-6 text-base rounded-xl",
        icon: "h-10 w-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
