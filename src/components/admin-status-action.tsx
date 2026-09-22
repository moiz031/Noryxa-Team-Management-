"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminStatusAction({
  endpoint,
  status,
  label,
}: {
  endpoint: string;
  status: string;
  label: string;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function update() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Update failed");
      } else {
        setMessage("Updated");
        window.location.reload();
      }
    } catch {
      setMessage("Network error");
    } finally {
      setPending(false);
    }
  }

  const isReject = label.toLowerCase().includes("reject");

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={update}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50",
          isReject
            ? "bg-[#FF4D67]/10 text-[#FF4D67] border border-[#FF4D67]/20 hover:bg-[#FF4D67]/20"
            : "bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/25 hover:bg-[#39FF14]/20 hover:shadow-[0_0_12px_rgba(57,255,20,0.2)]"
        )}
      >
        {pending && <Loader2 className="size-3 animate-spin" />}
        {label}
      </button>
      {message && <span className="text-[11px] text-[#A7AFBC]">{message}</span>}
    </span>
  );
}
