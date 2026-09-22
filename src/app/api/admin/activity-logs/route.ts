import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-wrapper';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Query validation schema – all fields optional
const activityLogsQuerySchema = z.object({
  actorId: z.string().optional(),
  entityType: z.string().optional(),
  actionType: z.string().optional(),
  source: z.string().optional(),
  archive: z.preprocess((v) => v === 'true' || v === true, z.boolean().optional()),
  startDate: z.string().optional().refine((val) => (val ? ISO_DATE.test(val) : true), { message: 'Invalid startDate' }),
  endDate: z.string().optional().refine((val) => (val ? ISO_DATE.test(val) : true), { message: 'Invalid endDate' }),
  page: z.preprocess((v) => Number(v), z.number().int().min(1).optional()),
  limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(100).optional()),
});

export const GET = apiHandler({
  auth: 'admin',
  validationSchema: activityLogsQuerySchema,
  handler: async (request: Request, { validated }) => {
    // Ensure admin context – requireAdmin may throw if not admin
    await requireAdmin();
    const { actorId, entityType, actionType, source, archive, startDate, endDate, page = 1, limit = 50 } = validated as z.infer<typeof activityLogsQuerySchema>;
    const supabase = createSupabaseAdminClient();
    const targetTable = archive ? 'activity_logs_archive' : 'activity_logs';
    let query = supabase
      .from(targetTable)
      .select(
        `id, actor_id, action_type, entity_type, entity_id, metadata, source, ip_address, org_context, created_at,
         profiles!actor_id(full_name, email)`,
        // Activity logs are append-heavy. A planned count avoids an additional
        // exact scan on every paginated admin request.
        { count: 'planned' }
      );
    if (actorId) query = query.eq('actor_id', actorId);
    if (entityType) query = query.eq('entity_type', entityType);
    if (actionType) query = query.ilike('action_type', `%${actionType}%`);
    if (source) query = query.eq('source', source);
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00.000Z`);
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59.999Z`);
    const offset = (page - 1) * limit;
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return NextResponse.json({ logs: data, total: count ?? 0, page, limit, archive: !!archive });
  },
});
