import { log } from '@/lib/observability/logger';

/**
 * Wrap a database query with error logging.
 * Provide a `requestId` (from API wrapper) to correlate logs.
 */
export async function withDbLogging<T>(operation: () => Promise<T>, requestId: string, meta: Record<string, unknown> = {}): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (process.env.ENABLE_OBSERVABILITY === 'true') {
      log.error({ requestId, error: err, ...meta }, 'Database operation failed');
    }
    throw err;
  }
}
