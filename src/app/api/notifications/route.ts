import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/api/rate-limit';
import { requireUser } from '@/lib/auth/roles';
import {
  getNotifications,
  getNotificationSummary,
  createNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  type CreateNotificationInput,
} from '@/lib/db/notifications';
import { z } from 'zod';

const createNotificationSchema = z.object({
  recipient_id: z.string().uuid(),
  type: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  body: z.string().max(1000).nullish(),
  entity_type: z.string().max(100).nullish(),
  entity_id: z.string().uuid().nullish(),
});

const readNotificationSchema = z.object({
  id: z.string().uuid().optional(),
  markAllRead: z.boolean().optional(),
}).refine((value) => Boolean(value.id) !== Boolean(value.markAllRead), {
  message: 'Provide exactly one of id or markAllRead',
});

/**
 * GET /api/notifications
 * Returns notifications for the currently authenticated user.
 */
async function getHandler(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    if (url.searchParams.get('summary') === 'true') {
      return NextResponse.json(await getNotificationSummary(user.user.id));
    }
    const unreadOnly = url.searchParams.get('unread') === 'true';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '20', 10))
    );

    const result = await getNotifications({
      recipientId: user.user.id,
      unreadOnly,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('auth')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    console.error('[GET /api/notifications]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * Creates a notification. Rate-limited to 20 per minute per user.
 */
async function postHandler(request: Request): Promise<Response> {
  try {
    const user = await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parse = createNotificationSchema.safeParse(body);
    if (!parse.success) {
      return NextResponse.json(
        { error: 'Invalid request payload', details: parse.error.issues },
        { status: 400 }
      );
    }

    const input: CreateNotificationInput = {
      recipient_id: parse.data.recipient_id,
      type: parse.data.type,
      title: parse.data.title,
      body: parse.data.body ?? null,
      entity_type: parse.data.entity_type ?? null,
      entity_id: parse.data.entity_id ?? null,
    };

    // Only allow users to create notifications for themselves unless the route is
    // called internally (checked by caller). Simple ownership check:
    if (input.recipient_id !== user.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const notification = await createNotification(input);
    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('auth')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    console.error('[POST /api/notifications]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function patchHandler(request: Request): Promise<Response> {
  try {
    const user = await requireUser();
    const parsed = readNotificationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid read-state request', details: parsed.error.issues }, { status: 400 });
    }

    if (parsed.data.markAllRead) {
      await markAllNotificationsAsRead(user.user.id);
      return NextResponse.json({ updated: true, scope: 'all' });
    }

    const notification = await markNotificationAsRead(parsed.data.id!, user.user.id);
    return NextResponse.json({ notification });
  } catch (err) {
    if (err instanceof Error && err.message.toLowerCase().includes('auth')) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }
    if (err instanceof Error && err.message === 'Notification not found') {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }
    console.error('[PATCH /api/notifications]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Apply rate limiting: 20 POST requests per minute per user/IP
export const GET = getHandler;
export const POST = withRateLimit(postHandler, {
  limit: 20,
  windowMs: 60_000,
});
export const PATCH = withRateLimit(patchHandler, {
  limit: 60,
  windowMs: 60_000,
});
