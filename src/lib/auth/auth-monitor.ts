import { log } from '@/lib/observability/logger';

/**
 * Wrap Supabase auth operations with error logging.
 * Provide a requestId (from API wrapper) to correlate logs when possible.
 */
export async function withAuthLogging<T>(operation: () => Promise<T>, requestId: string, meta: Record<string, unknown> = {}): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (process.env.ENABLE_OBSERVABILITY === 'true') {
      log.error({ requestId, error: err, ...meta }, 'Auth operation failed');
    }
    throw err;
  }
}
