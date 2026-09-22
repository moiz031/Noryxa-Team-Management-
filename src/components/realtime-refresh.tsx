"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

export function RealtimeRefresh({ tables }: { tables: string[] }) {
  useEffect(() => {
    const env = getPublicEnv();
    const client = createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
    const channel = client.channel("agency-operating-updates");
    tables.forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () => window.location.reload());
    });
    channel.subscribe();
    return () => { void client.removeChannel(channel); };
  }, [tables]);
  return null;
}
