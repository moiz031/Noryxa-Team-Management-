"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";

export function MarkAllNotificationsReadButton() {
  const [pending, setPending] = useState(false);

  async function markAllRead() {
    setPending(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (response.ok) window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markAllRead}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[#A7AFBC] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5 text-[#39FF14]" />}
      Mark all as read
    </button>
  );
}

export function MarkNotificationReadButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);

  async function markRead() {
    setPending(true);
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) window.location.reload();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={markRead}
      disabled={pending}
      aria-label="Mark notification as read"
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#A7AFBC] transition-colors hover:border-[#39FF14]/30 hover:text-[#39FF14] disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
      Mark read
    </button>
  );
}
