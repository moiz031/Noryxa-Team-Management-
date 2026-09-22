// Structured logger with sensitive data redaction for observability
// Production-safe, zero external dependencies to prevent bundling/runtime issues

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'service_role_key',
  'apikey',
]);

function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = k.toLowerCase();
    const isSensitive =
      SENSITIVE_KEYS.has(lowerKey) ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('token') ||
      lowerKey.includes('cookie');

    if (isSensitive) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      sanitized[k] = redactSensitive(v, depth + 1);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

function outputLog(level: LogLevel, dataOrMsg: unknown, maybeMsg?: string) {
  const timestamp = new Date().toISOString();
  let message: string | undefined;
  let meta: Record<string, unknown> = {};

  if (typeof dataOrMsg === 'string') {
    message = dataOrMsg;
  } else if (typeof dataOrMsg === 'object' && dataOrMsg !== null) {
    meta = redactSensitive(dataOrMsg) as Record<string, unknown>;
    message = maybeMsg;
  }

  const logPayload = {
    timestamp,
    level,
    ...(message ? { message } : {}),
    ...meta,
  };

  const jsonStr = JSON.stringify(logPayload);
  if (level === 'error') {
    console.error(jsonStr);
  } else if (level === 'warn') {
    console.warn(jsonStr);
  } else {
    console.log(jsonStr);
  }
}

export const log = {
  debug: (data: unknown, msg?: string) => outputLog('debug', data, msg),
  info: (data: unknown, msg?: string) => outputLog('info', data, msg),
  warn: (data: unknown, msg?: string) => outputLog('warn', data, msg),
  error: (data: unknown, msg?: string) => outputLog('error', data, msg),
};
