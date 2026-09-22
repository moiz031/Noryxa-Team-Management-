import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles'; // retained for legacy admin info if needed
import { listBatch2, insertBatch2 } from '@/lib/db/batch2';
import { teamSchema } from '@/lib/validation/batch2';
import { apiHandler } from '@/lib/api/api-wrapper';

export const GET = apiHandler({
  auth: 'admin',
  handler: async () => {
    const teams = await listBatch2('teams');
    return NextResponse.json({ teams });
  },
});

export const POST = apiHandler({
  auth: 'admin',
  validationSchema: teamSchema,
  activityLog: {
    actionType: 'team.created',
    entityType: 'team',
    entityIdGetter: (response) => {
      if (!response || typeof response !== "object") return null;
      const team = (response as { team?: { id?: unknown } }).team;
      return typeof team?.id === "string" ? team.id : null;
    },
  },
  handler: async (request: Request) => {
    // admin info is needed for created_by/updated_by fields
    const admin = await requireAdmin();
    const payload = await request.json();
    const data = { ...payload, created_by: admin.user.id, updated_by: admin.user.id };
    const team = await insertBatch2('teams', data);
    return NextResponse.json({ team }, { status: 201 });
  },
});
