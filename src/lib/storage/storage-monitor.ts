import { log } from '@/lib/observability/logger';

/**
 * Wrap Supabase storage operations with error logging.
 * Usage: await withStorageLogging(() => supabase.storage.from('bucket').upload(...));
 */
export async function withStorageLogging<T>(operation: () => Promise<T>, meta: Record<string, unknown> = {}): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (process.env.ENABLE_OBSERVABILITY === 'true') {
      log.error({ error: err, ...meta }, 'Storage operation failed');
    }
    throw err;
  }
}
