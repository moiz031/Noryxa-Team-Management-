import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { z } from 'zod';

// Allowed export entities and their safe column sets
const EXPORT_DEFS: Record<
  string,
  { table: string; columns: string[] }
> = {
  employees: { table: 'employees', columns: ['id', 'profile_id', 'employee_code', 'department_id', 'manager_id', 'job_title', 'joined_on', 'employment_status', 'approved_at', 'created_at', 'updated_at'] },
  tasks: { table: 'tasks', columns: ['id', 'title', 'status', 'priority', 'assigned_to', 'project_id', 'start_date', 'due_date', 'due_at', 'completed_at', 'created_at', 'updated_at'] },
  projects: { table: 'projects', columns: ['id', 'name', 'description', 'client_id', 'client_name', 'department_id', 'status', 'starts_on', 'due_on', 'created_at', 'updated_at'] },
  reports: { table: 'daily_reports', columns: ['id', 'employee_id', 'report_date', 'status', 'summary', 'blockers', 'tomorrow_plan', 'created_at', 'updated_at'] },
  attendance: { table: 'attendance', columns: ['id', 'employee_id', 'attendance_date', 'status', 'check_in_at', 'check_out_at', 'note', 'created_at', 'updated_at'] },
  leaves: { table: 'leave_requests', columns: ['id', 'employee_id', 'leave_type', 'starts_on', 'ends_on', 'reason', 'status', 'reviewed_at', 'created_at', 'updated_at'] },
  time_entries: { table: 'time_entries', columns: ['id', 'employee_id', 'task_id', 'started_at', 'ended_at', 'duration_seconds', 'notes', 'created_at', 'updated_at'] },
  activity_logs: { table: 'activity_logs', columns: ['id', 'actor_id', 'action_type', 'entity_type', 'entity_id', 'metadata', 'created_at'] },
};

// Payload validation – entity must be one of the keys above; optional filters map directly to column equality checks
const exportSchema = z.object({
  entity: z.enum(Object.keys(EXPORT_DEFS) as [string, ...string[]]),
  filters: z.record(z.string(), z.string()).optional(),
  limit: z.number().int().min(1).max(10000).optional(),
});

/**
 * Admin‑only data export endpoint.
 * Returns JSON‑serializable rows respecting column whitelist, optional equality filters, and a hard‑coded row cap.
 * An audit entry is written to `activity_logs` with action_type='export'.
 * Rate‑limited to 5 requests per minute per admin (IP‑based fallback).
 */
async function exportHandler(request: Request) {
  try {
    await requireAdmin();
    const payload = await request.json();
    const parse = exportSchema.safeParse(payload);
    if (!parse.success) {
      return NextResponse.json({ error: 'Invalid export request', details: parse.error.issues }, { status: 400 });
    }
    const { entity, filters = {}, limit = 1000 } = parse.data;
    const { table, columns } = EXPORT_DEFS[entity];

    const supabase = await createSupabaseServerClient();
    let query = supabase.from(table).select(columns.join(',')).limit(limit);
    // Apply simple equality filters (only whitelist columns can be filtered)
    for (const [key, value] of Object.entries(filters)) {
      if (columns.includes(key)) {
        query = query.eq(key, value);
      }
    }
    const { data, error } = await query;
    if (error) {
      console.error('[POST /api/export]', error.message);
      return NextResponse.json({ error: 'Export could not be completed' }, { status: 500 });
    }

    // Audit log – store minimal info, omit the data itself for privacy
    await supabase.from('activity_logs').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id || null,
      action_type: 'export',
      entity_type: entity,
      entity_id: null,
      metadata: { filters, rows_exported: data?.length ?? 0 },
    });

    return NextResponse.json({ rows: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unexpected server error' }, { status: 500 });
  }
}

// Apply rate limiting: 5 POST requests per minute per admin/IP
export const POST = withRateLimit(exportHandler, {
  limit: 5,
  windowMs: 60_000,
});
