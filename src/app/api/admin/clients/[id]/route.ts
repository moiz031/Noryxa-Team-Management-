import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { deleteBatch2, updateBatch2 } from "@/lib/db/batch2";
import { clientSchema } from "@/lib/validation/batch2";
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) { try { const admin = await requireAdmin(); const parsed = clientSchema.partial().safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); return NextResponse.json({ client: await updateBatch2("clients", (await params).id, { ...parsed.data, updated_by: admin.user.id }) }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); } }
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) { try { await requireAdmin(); await deleteBatch2("clients", (await params).id); return new NextResponse(null, { status: 204 }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); } }
