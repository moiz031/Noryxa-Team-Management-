import { NextResponse } from "next/server";
import { requireEmployee } from "@/lib/auth/roles";
import { createTaskComment, getTaskComments, updateTaskComment, deleteTaskComment } from "@/lib/db/task-comments";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications/engine";
import { withRateLimit } from "@/lib/api/rate-limit";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = message.includes("Authentication required") ? 401 : message.includes("Account is inactive") ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireEmployee();
    const { id } = await params;
    return NextResponse.json({ comments: await getTaskComments(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

async function postHandler(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const employee = await requireEmployee();
    const { id } = await params;
    const body = await request.json();
    if (typeof body.body !== "string" || body.body.trim().length < 1 || body.body.trim().length > 5000) {
      return NextResponse.json({ error: "Comment must be between 1 and 5000 characters" }, { status: 400 });
    }

    const comment = await createTaskComment(id, employee.user.id, body.body.trim());
    const adminDb = createSupabaseAdminClient();
    await adminDb.from("activity_logs").insert({ actor_id: employee.user.id, action_type: "task.comment_added", entity_type: "task", entity_id: id, metadata: { comment_id: comment.id } });
    const { data: taskContext } = await adminDb.from("tasks").select("project_id,assigned_to,created_by").eq("id", id).single();
    const allowedEmployeeIds = new Set<string>();
    if (taskContext?.assigned_to) allowedEmployeeIds.add(taskContext.assigned_to);
    if (taskContext?.project_id) {
      const { data: members } = await adminDb.from("project_members").select("employee_id").eq("project_id", taskContext.project_id);
      for (const member of members ?? []) allowedEmployeeIds.add(member.employee_id);
    }
    const { data: allowedEmployees } = allowedEmployeeIds.size
      ? await adminDb.from("employees").select("id,profile_id").in("id", [...allowedEmployeeIds])
      : { data: [] as { id: string; profile_id: string }[] };
    const allowedProfiles = new Set((allowedEmployees ?? []).map((item) => item.profile_id));
    if (taskContext?.created_by) allowedProfiles.add(taskContext.created_by);
    const mentionedNames = [...comment.body.matchAll(/@([A-Za-z0-9._+-]+)/g)].map((match) => match[1].toLowerCase());
    const { data: profiles } = allowedProfiles.size
      ? await adminDb.from("profiles").select("id,email,full_name").in("id", [...allowedProfiles])
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };
    for (const profile of profiles ?? []) {
      const emailName = profile.email?.split("@")[0]?.toLowerCase();
      const fullName = profile.full_name?.toLowerCase().replace(/\s+/g, ".");
      if (profile.id === employee.user.id || !emailName || (!mentionedNames.includes(emailName) && !mentionedNames.includes(fullName ?? ""))) continue;
      const { error: mentionError } = await adminDb.from("mentions").insert({ actor_id: employee.user.id, mentioned_profile_id: profile.id, entity_type: "task_comment", entity_id: comment.id });
      if (!mentionError) {
        await notify({ recipientId: profile.id, actorId: employee.user.id, type: "mention", title: "You were mentioned in a task comment", body: comment.body.slice(0, 180), entityType: "task_comment", entityId: comment.id, preference: "mention_notifications", dedupeKey: `mention:task_comment:${comment.id}:${profile.id}` });
        await adminDb.from("activity_logs").insert({ actor_id: employee.user.id, action_type: "mention.created", entity_type: "task_comment", entity_id: comment.id, metadata: { mentioned_profile_id: profile.id } });
      }
    }
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export const POST = withRateLimit(postHandler, { limit: 30, windowMs: 60_000 });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      await requireEmployee();
      const { id } = await params;
      const parsed = z.object({ body: z.string().trim().min(1).max(5000) }).safeParse(await request.json());
      if (!parsed.success) return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
      const comment = await updateTaskComment(id, parsed.data.body);
      await createSupabaseAdminClient().from("activity_logs").insert({ actor_id: (await requireEmployee()).user.id, action_type: "task.comment_updated", entity_type: "task_comment", entity_id: id });
      return NextResponse.json({ comment });
    } catch (error) { return errorResponse(error); }
  }

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
      await requireEmployee();
      const { id } = await params;
      await deleteTaskComment(id);
      return NextResponse.json({ success: true });
    } catch (error) { return errorResponse(error); }
}
