"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export function RealtimeRefresh({ tables }: { tables: string[] }) {
  const router = useRouter() as { refresh(): void };
  const tablesKey = useMemo(() => tables.join(","), [tables]);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const env = getPublicEnv();
    const client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const channel = client.channel("agency-operating-updates");
    tablesKey.split(",").filter(Boolean).forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => {
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 150);
      });
    });
    channel.subscribe();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      void client.removeChannel(channel);
    };
  }, [router, tablesKey]);
  return null;
}
