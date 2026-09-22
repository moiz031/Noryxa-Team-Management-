import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/roles";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const templateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(["template", "general"]).default("template"),
  description: z.string().optional().nullable(),
  storage_path: z.string().optional(),
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

    let query = auth.supabase.from("templates").select("*", { count: "exact" });
    if (category) query = query.eq("category", category);
    if (isActive !== null) query = query.eq("is_active", isActive === "true");
    if (q && q.trim().length >= 2) query = query.ilike("name", `%${q.trim()}%`);

    const { data, error, count } = await query
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ templates: data, total: count ?? 0, page, limit });
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

    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: template, error } = await auth.supabase
      .from("templates")
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
        action_type: "template.created",
        entity_type: "template",
        entity_id: template.id,
        metadata: { name: template.name, category: template.category },
      });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (!id) {
      return NextResponse.json({ error: "Template ID required" }, { status: 400 });
    }
    
    const { data: template, error: getError } = await auth.supabase
      .from("templates")
      .select("name")
      .eq("id", id)
      .single();
    
    if (getError || !template) {
      return NextResponse.json({ error: "Template not found or unauthorized" }, { status: 404 });
    }
    
    const { error: deleteError } = await auth.supabase
      .from("templates")
      .delete()
      .eq("id", id);
    
    if (deleteError) {
      return NextResponse.json({ error: "Unauthorized to delete" }, { status: 403 });
    }
    
    // Activity log
    await createSupabaseAdminClient()
      .from("activity_logs")
      .insert({
        actor_id: auth.user.id,
        action_type: "template.deleted",
        entity_type: "template",
        entity_id: id,
        metadata: { name: template.name }
      });
    
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const status = message.includes("Authentication required") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}