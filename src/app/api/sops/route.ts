import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const sopSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  category: z.enum(["sop", "general"]).default("sop"),
  version: z.number().int().nonnegative().default(1),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
  is_active: z.boolean().default(true),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const isActive = url.searchParams.get("isActive");
    const q = url.searchParams.get("q");
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
    const offset = (page - 1) * limit;

    let query = auth.supabase.from("sops").select("*", { count: "exact" });
    if (category) query = query.eq("category", category);
    if (isActive !== null) query = query.eq("is_active", isActive === "true");
    if (q && q.trim().length >= 2) query = query.ilike("title", `%${q.trim()}%`);

    const { data, error, count } = await query
      .order("version", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ sops: data, total: count ?? 0, page, limit });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();

    const parsed = sopSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: sop, error } = await auth.supabase
      .from("sops")
      .insert({
        ...parsed.data,
        owner_id: auth.user.id,
      })
      .select()
      .single();

    if (error) throw error;

    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "sop.created",
        entity_type: "sop",
        entity_id: sop.id,
        metadata: { title: sop.title, category: sop.category, version: sop.version },
      });

    return NextResponse.json({ sop }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
