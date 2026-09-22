"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#07090D]/80 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#0E1117] p-6 shadow-[0_24px_50px_rgba(0,0,0,0.8)] animate-modal-in",
          className
        )}
      >
        <div className="flex items-start justify-between pb-4">
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-[#F5F7FA]">{title}</h3>
            )}
            {description && (
              <p className="mt-1 text-sm text-[#A7AFBC]">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#A7AFBC] hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
