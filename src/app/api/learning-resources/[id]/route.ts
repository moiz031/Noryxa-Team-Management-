import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  resource_type: z.enum(["video", "image", "guide", "test"]).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  content: z.string().max(30000).optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  duration_minutes: z.number().int().min(1).max(1440).optional().nullable(),
  quiz_questions: z.array(z.object({ question: z.string(), options: z.array(z.string()).min(2), answer: z.number().int().min(0) })).optional(),
  is_published: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Only admins can update learning resources" }, { status: 403 });
    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const payload = { ...parsed.data, updated_by: auth.user.id, ...(parsed.data.is_published === true ? { published_at: new Date().toISOString() } : {}) };
    const { data: resource, error } = await auth.supabase.from("learning_resources").update(payload).eq("id", id).select("*").single();
    if (error) throw new Error(error.message);

    if (parsed.data.is_published === true) {
      const adminDb = createSupabaseAdminClient();
      const { data: employees } = await adminDb.from("employees").select("profile_id").eq("employment_status", "active").neq("profile_id", auth.user.id);
      await Promise.all((employees ?? []).map((employee) => adminDb.from("notifications").upsert({
        recipient_id: employee.profile_id,
        actor_id: auth.user.id,
        type: "learning.published",
        title: "New Learn & Tips resource",
        body: resource.title,
        entity_type: "learning_resource",
        entity_id: resource.id,
        dedupe_key: `learning-published:${resource.id}:${employee.profile_id}`,
        metadata: {},
      }, { onConflict: "dedupe_key", ignoreDuplicates: true })));
    }
    return NextResponse.json({ resource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Only admins can delete learning resources" }, { status: 403 });
    const { id } = await params;
    const { error } = await auth.supabase.from("learning_resources").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}
