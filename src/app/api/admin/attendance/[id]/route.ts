import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { getAttendanceById, updateAttendance } from "@/lib/db/attendance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { attendanceCorrectionSchema } from "@/lib/validation/batch2";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const attendance = await getAttendanceById(id);
    if (!attendance) return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    const parsed = attendanceCorrectionSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const { checkInAt, checkOutAt, note, status } = parsed.data;
    if (checkOutAt && !checkInAt && !attendance.check_in_at) {
      return NextResponse.json({ error: "A check-in timestamp is required before check-out" }, { status: 400 });
    }
    const effectiveIn = checkInAt === undefined ? attendance.check_in_at : checkInAt;
    const effectiveOut = checkOutAt === undefined ? attendance.check_out_at : checkOutAt;
    if (effectiveIn && effectiveOut && new Date(effectiveOut) < new Date(effectiveIn)) {
      return NextResponse.json({ error: "Check-out cannot be before check-in" }, { status: 400 });
    }
    const updated = await updateAttendance({
      id,
      updated_by: admin.user.id,
      ...(status ? { status } : {}),
      ...(checkInAt !== undefined ? { check_in_at: checkInAt } : {}),
      ...(checkOutAt !== undefined ? { check_out_at: checkOutAt } : {}),
      ...(note !== undefined ? { note } : {}),
    });
    await createSupabaseAdminClient().rpc("log_activity", {
      p_action_type: "attendance.corrected", p_entity_type: "attendance", p_entity_id: id,
      p_metadata: { fields: Object.keys(parsed.data) },
    });
    return NextResponse.json({ attendance: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication required") ? 401 : message.includes("Admin access required") ? 403 : 500 });
  }
}
