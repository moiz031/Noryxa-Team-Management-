"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export function DocumentDownloadButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      const payload = (await response.json()) as { signedUrl?: string; error?: string };
      if (!response.ok || !payload.signedUrl) {
        throw new Error(payload.error ?? "Download unavailable");
      }
      window.open(payload.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      window.alert("This document is not available for download.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B5CF6]/30 bg-[#8B5CF6]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#C4B5FD] transition-colors hover:bg-[#8B5CF6]/20 disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
      Download
    </button>
  );
}
