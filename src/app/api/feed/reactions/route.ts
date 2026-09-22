import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { reactionSchema } from "@/lib/validation/batch4";
import { withRateLimit } from "@/lib/api/rate-limit";

const REACTION_RATE_LIMIT = { limit: 60, windowMs: 60_000 };

async function postHandler(request: Request) {
  try {
    const user = await requireUser();
    const parsed = reactionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = await createSupabaseServerClient();
    const { data, error } = await db.from("reactions").insert({ ...parsed.data, actor_id: user.user.id }).select("*").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    await createSupabaseAdminClient().rpc("log_activity", { p_action_type: "reaction.added", p_entity_type: parsed.data.entity_type, p_entity_id: parsed.data.entity_id, p_metadata: { reaction: parsed.data.reaction } });
    return NextResponse.json({ reaction: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

async function deleteHandler(request: Request) {
  try {
    const user = await requireUser();
    const parsed = reactionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { error } = await (await createSupabaseServerClient()).from("reactions").delete().match({ actor_id: user.user.id, ...parsed.data });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected server error" }, { status: 500 });
  }
}

// Rate-limited: 60 reactions per minute per user/IP
export const POST = withRateLimit(postHandler, REACTION_RATE_LIMIT);
export const DELETE = withRateLimit(deleteHandler, REACTION_RATE_LIMIT);
