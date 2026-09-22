import { NextResponse } from 'next/server';
import { requireAuth, requireAdmin } from '@/lib/auth/roles';
import { getOrganizationSettings, updateOrganizationSettings } from '@/lib/db/organization-settings';
import { z } from 'zod';
import { apiHandler } from '@/lib/api/api-wrapper';
import { logAuditEvent } from '@/lib/audit/logger';

// Validation schema for PATCH payload (optional fields)
const organizationSettingsPatchSchema = z.object({
  organization_name: z.string().optional(),
  timezone: z.string().optional(),
  default_work_week: z.array(z.string()).optional(),
  default_work_start_time: z.string().optional(),
  default_work_end_time: z.string().optional(),
  max_file_upload_mb: z.number().int().optional(),
  default_leave_days_per_year: z.number().int().optional(),
  allow_employee_feed_post: z.boolean().optional(),
  allow_employee_comment: z.boolean().optional(),
});

export const GET = apiHandler({
  auth: 'auth',
  handler: async () => {
    const settings = await getOrganizationSettings();
    return NextResponse.json({ settings });
  },
});

export const PATCH = apiHandler({
  auth: 'admin',
  validationSchema: organizationSettingsPatchSchema,
  handler: async (request: Request) => {
    const admin = await requireAdmin();
    const payload = await request.json();
    const updated = await updateOrganizationSettings(payload);
    await logAuditEvent({
      actorId: admin.user.id,
      event: 'settings.updated',
      entityType: 'organization_settings',
      entityId: updated.id,
      metadata: {
        updated_fields: Object.keys(payload),
      },
      request,
    });
    return NextResponse.json({ settings: updated });
  },
});
