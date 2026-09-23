import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";

const progressSchema = z.object({
  status: z.enum(["started", "completed"]),
  score: z.number().min(0).max(100).nullable().optional(),
  answers: z.record(z.string(), z.number().int().min(0)).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await params;
    const parsed = progressSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const { data: progress, error } = await auth.supabase
      .from("learning_progress")
      .upsert({
        resource_id: id,
        profile_id: auth.user.id,
        status: parsed.data.status,
        score: parsed.data.score ?? null,
        answers: parsed.data.answers ?? {},
        completed_at: parsed.data.status === "completed" ? new Date().toISOString() : null,
      }, { onConflict: "resource_id,profile_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : 500 });
  }
}
