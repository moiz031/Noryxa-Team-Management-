import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/roles";
import { insertBatch2, listBatch2 } from "@/lib/db/batch2";
import { scheduleAssignmentSchema } from "@/lib/validation/batch2";

export async function GET() { 
  try { 
    await requireAdmin(); 
    return NextResponse.json({ scheduleAssignments: await listBatch2("schedule_assignments") }); 
  } catch (e) { 
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); 
  } 
}

export async function POST(request: Request) { 
  try { 
    await requireAdmin(); 
    const parsed = scheduleAssignmentSchema.safeParse(await request.json()); 
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 }); 
    return NextResponse.json({ scheduleAssignment: await insertBatch2("schedule_assignments", parsed.data) }, { status: 201 }); 
  } catch (e) { 
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unexpected server error" }, { status: 500 }); 
  } 
}
