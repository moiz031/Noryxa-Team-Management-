import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateSchema = z.object({
  action: z.enum(["mark_commissions_paid", "rebuild"]).optional(),
  payment_status: z.enum(["pending", "partially_paid", "paid", "cancelled"]).optional(),
  amount_paid: z.number().min(0).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    if (auth.role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const db = createSupabaseAdminClient();

    if (parsed.data.action === "mark_commissions_paid") {
      const { error } = await db.from("commission_entries").update({ status: "paid", paid_at: new Date().toISOString() }).eq("project_revenue_id", id).neq("status", "paid");
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    const updates = {
      ...(parsed.data.payment_status !== undefined ? { payment_status: parsed.data.payment_status } : {}),
      ...(parsed.data.amount_paid !== undefined ? { amount_paid: parsed.data.amount_paid } : {}),
    };
    if (updates.payment_status || updates.amount_paid !== undefined) {
      const { data: deal } = await db.from("project_revenue").select("total_amount,amount_paid").eq("id", id).single();
      if (!deal) return NextResponse.json({ error: "Revenue deal not found" }, { status: 404 });
      const amountPaid = updates.amount_paid ?? Number(deal.amount_paid);
      if (amountPaid > Number(deal.total_amount)) return NextResponse.json({ error: "Paid amount cannot exceed total amount" }, { status: 400 });
      const { error } = await db.from("project_revenue").update({ ...updates, updated_by: auth.user.id }).eq("id", id);
      if (error) throw new Error(error.message);
    }
    await db.rpc("rebuild_commission_entries", { target_revenue_id: id });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication") ? 401 : 500 });
  }
}
