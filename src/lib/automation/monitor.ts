import { log } from '@/lib/observability/logger';

/**
 * Simple helper to log informational messages from automation scripts.
 * Logging is performed only when ENABLE_OBSERVABILITY is set to "true".
 */
export function logInfo(message: string, meta: Record<string, unknown> = {}) {
  if (process.env.ENABLE_OBSERVABILITY === 'true') {
    log.info({ ...meta }, message);
  }
}

/**
 * Simple helper to log error messages from automation scripts.
 * Logging is performed only when ENABLE_OBSERVABILITY is set to "true".
 */
export function logError(message: string, error: unknown, meta: Record<string, unknown> = {}) {
  if (process.env.ENABLE_OBSERVABILITY === 'true') {
    log.error({ error, ...meta }, message);
  }
}
