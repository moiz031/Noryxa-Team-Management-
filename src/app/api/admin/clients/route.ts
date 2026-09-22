import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { listBatch2, insertBatch2 } from "@/lib/db/batch2";
import { clientSchema } from "@/lib/validation/batch2";
export async function GET() { try { await requireAdmin(); return NextResponse.json({ clients: await listBatch2("clients") }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); } }
export async function POST(request: Request) { try { const admin = await requireAdmin(); const parsed = clientSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); return NextResponse.json({ client: await insertBatch2("clients", { ...parsed.data, created_by: admin.user.id, updated_by: admin.user.id }) }, { status: 201 }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); } }
