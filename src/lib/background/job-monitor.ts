import { log } from '@/lib/observability/logger';

/**
 * Wrap a background job (cron/task) execution with error logging.
 * Provide a `jobName` to identify the job in logs.
 */
export async function withJobLogging<T>(jobName: string, operation: () => Promise<T>, meta: Record<string, unknown> = {}): Promise<T> {
  if (process.env.ENABLE_OBSERVABILITY === 'true') {
    log.info({ jobName, ...meta }, `Job started`);
  }
  try {
    const result = await operation();
    if (process.env.ENABLE_OBSERVABILITY === 'true') {
      log.info({ jobName, ...meta }, `Job completed successfully`);
    }
    return result;
  } catch (err) {
    if (process.env.ENABLE_OBSERVABILITY === 'true') {
      log.error({ jobName, error: err, ...meta }, 'Job failed');
    }
    throw err;
  }
}
