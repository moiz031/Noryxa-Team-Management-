import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { listEarningsEmployees, listRevenueDeals, listRevenueProjects } from "@/lib/db/earnings";
import { withRateLimit } from "@/lib/api/rate-limit";

const dealSchema = z.object({
  project_id: z.string().uuid(),
  total_amount: z.number().positive(),
  amount_paid: z.number().min(0),
  currency: z.enum(["PKR", "USD", "AED", "GBP", "EUR"]).default("PKR"),
  payment_status: z.enum(["pending", "partially_paid", "paid", "cancelled"]).default("pending"),
  client_brought_by: z.string().uuid().nullable().optional(),
  closed_by: z.string().uuid().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.amount_paid > value.total_amount) ctx.addIssue({ code: "custom", path: ["amount_paid"], message: "Paid amount cannot exceed total amount" });
  if (value.payment_status === "pending" && value.amount_paid !== 0) ctx.addIssue({ code: "custom", path: ["amount_paid"], message: "Pending deals must have zero paid amount" });
  if (value.payment_status === "partially_paid" && (value.amount_paid <= 0 || value.amount_paid >= value.total_amount)) ctx.addIssue({ code: "custom", path: ["amount_paid"], message: "Partially paid deals must be between zero and the total" });
  if (value.payment_status === "paid" && value.amount_paid <= 0) ctx.addIssue({ code: "custom", path: ["amount_paid"], message: "Paid deals need a paid amount" });
});

async function requireAdminApi() {
  const auth = await requireAuth();
  if (auth.role !== "admin") throw new Error("Admin access required");
  return auth;
}

export async function GET() {
  try {
    await requireAdminApi();
    const [deals, employees, projects] = await Promise.all([listRevenueDeals(), listEarningsEmployees(), listRevenueProjects()]);
    return NextResponse.json({ deals, employees, projects });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication") || message.includes("access") ? 403 : 500 });
  }
}

async function postHandler(request: Request) {
  try {
    const auth = await requireAdminApi();
    const parsed = dealSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    const adminDb = createSupabaseAdminClient();
    const { data: project } = await adminDb.from("projects").select("id,client_id").eq("id", parsed.data.project_id).maybeSingle();
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const { data: deal, error } = await adminDb.from("project_revenue").insert({
      ...parsed.data,
      client_id: project.client_id,
      client_brought_by: parsed.data.client_brought_by ?? null,
      closed_by: parsed.data.closed_by ?? null,
      created_by: auth.user.id,
      updated_by: auth.user.id,
    }).select("*").single();
    if (error) throw new Error(error.message);

    await adminDb.rpc("rebuild_commission_entries", { target_revenue_id: deal.id });
    await adminDb.rpc("log_activity", { p_action_type: "revenue.deal_recorded", p_entity_type: "project_revenue", p_entity_id: deal.id, p_metadata: { project_id: deal.project_id, payment_status: deal.payment_status, amount_paid: deal.amount_paid } });
    return NextResponse.json({ deal }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: message.includes("Authentication") ? 401 : message.includes("access") ? 403 : 500 });
  }
}

export const POST = withRateLimit(postHandler, { limit: 20, windowMs: 60_000 });
