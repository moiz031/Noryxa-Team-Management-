import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

const quizQuestionSchema = z.object({
  question: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
  answer: z.number().int().min(0).max(5),
});

const resourceSchema = z.object({
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().max(1000).optional().nullable(),
  resource_type: z.enum(["video", "image", "guide", "test"]).default("guide"),
  category: z.string().trim().min(1).max(80).default("general"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
  content: z.string().max(30000).optional().nullable(),
  media_url: z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  duration_minutes: z.number().int().min(1).max(1440).optional().nullable(),
  quiz_questions: z.array(quizQuestionSchema).default([]),
  is_published: z.boolean().default(false),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q")?.trim();

    let query = auth.supabase.from("learning_resources").select("*").order("created_at", { ascending: false });
    if (auth.role !== "admin") query = query.eq("is_published", true);
    if (type) query = query.eq("resource_type", type);
    if (category) query = query.eq("category", category);
    if (q && q.length >= 2) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);

    const [{ data: resources, error }, { data: progress }] = await Promise.all([
      query,
      auth.supabase.from("learning_progress").select("resource_id,status,score,completed_at,updated_at").eq("profile_id", auth.user.id),
    ]);
    if (error) throw new Error(error.message);

    const progressByResource = new Map((progress ?? []).map((item) => [item.resource_id, item]));
    return NextResponse.json({
      resources: (resources ?? []).map((resource) => ({ ...resource, progress: progressByResource.get(resource.id) ?? null })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}

async function postHandler(request: Request) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Only admins can publish learning resources" }, { status: 403 });
    const parsed = resourceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const payload = {
      ...parsed.data,
      created_by: auth.user.id,
      updated_by: auth.user.id,
      published_at: parsed.data.is_published ? new Date().toISOString() : null,
    };
    const { data: resource, error } = await auth.supabase.from("learning_resources").insert(payload).select("*").single();
    if (error) throw new Error(error.message);

    if (resource.is_published) {
      const adminDb = createSupabaseAdminClient();
      const { data: employees } = await adminDb.from("employees").select("profile_id").eq("employment_status", "active");
      await Promise.all((employees ?? []).filter((employee) => employee.profile_id !== auth.user.id).map((employee) => notify({
        recipientId: employee.profile_id,
        actorId: auth.user.id,
        type: "learning.published",
        title: "New Learn & Tips resource",
        body: resource.title,
        entityType: "learning_resource",
        entityId: resource.id,
        dedupeKey: `learning-published:${resource.id}:${employee.profile_id}`,
      })));
      await adminDb.rpc("log_activity", { p_action_type: "learning.resource_published", p_entity_type: "learning_resource", p_entity_id: resource.id, p_metadata: { title: resource.title, resource_type: resource.resource_type } });
    }

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}

export const POST = withRateLimit(postHandler, { limit: 20, windowMs: 60_000 });
