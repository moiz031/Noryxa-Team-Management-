import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/roles';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notificationPreferenceSchema } from '@/lib/validation/batch4';
import { apiHandler } from '@/lib/api/api-wrapper';

export const GET = apiHandler({
  auth: 'user',
  handler: async (_request: Request) => {
    const user = await requireUser();
    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('notification_preferences')
      .select('*')
      .eq('profile_id', user.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return NextResponse.json({
      preferences: data ?? {
        profile_id: user.user.id,
        task_notifications: true,
        report_notifications: true,
        leave_notifications: true,
        mention_notifications: true,
        announcement_notifications: true,
      },
    });
  },
});

export const PATCH = apiHandler({
  auth: 'user',
  handler: async (request: Request) => {
    const user = await requireUser();
    const parsed = notificationPreferenceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid preferences' }, { status: 400 });
    }
    const { data, error } = await (await createSupabaseServerClient())
      .from('notification_preferences')
      .upsert({ profile_id: user.user.id, ...parsed.data }, { onConflict: 'profile_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ preferences: data });
  },
});
