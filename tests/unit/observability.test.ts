/**
 * tests/unit/observability.test.ts
 *
 * Verifies that:
 *  1. Logger correctly outputs JSON structured logs.
 *  2. Sensitive keys (password, token, secret, cookie, authorization) are redacted to [REDACTED].
 *  3. withStorageLogging delegates properly on success and logs/rethrows on failure.
 */

import { log } from '@/lib/observability/logger';
import { withStorageLogging } from '@/lib/storage/storage-monitor';

describe('Observability & Logger (Batch 24)', () => {
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('outputs structured JSON for info and debug logs', () => {
    log.info({ testKey: 'testValue' }, 'test info message');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('test info message');
    expect(parsed.testKey).toBe('testValue');
    expect(parsed.timestamp).toBeDefined();
  });

  it('outputs structured JSON for warn logs to console.warn', () => {
    log.warn({ warningDetail: 'low_disk' }, 'Disk space warning');

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(warnSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('warn');
    expect(parsed.message).toBe('Disk space warning');
    expect(parsed.warningDetail).toBe('low_disk');
  });

  it('outputs structured JSON for error logs to console.error', () => {
    log.error({ code: 500 }, 'Internal server error');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Internal server error');
    expect(parsed.code).toBe(500);
  });

  it('automatically redacts sensitive fields from metadata', () => {
    log.info({
      user: 'admin',
      password: 'SuperSecretPassword123',
      token: 'jwt.token.here',
      authorization: 'Bearer xyz',
      nested: {
        api_secret: 'secret-12345',
        cookie: 'session_id=abc',
        normalField: 'hello',
      },
    }, 'User authenticated');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.user).toBe('admin');
    expect(parsed.password).toBe('[REDACTED]');
    expect(parsed.token).toBe('[REDACTED]');
    expect(parsed.authorization).toBe('[REDACTED]');
    expect(parsed.nested.api_secret).toBe('[REDACTED]');
    expect(parsed.nested.cookie).toBe('[REDACTED]');
    expect(parsed.nested.normalField).toBe('hello');
  });

  describe('withStorageLogging', () => {
    const originalEnv = process.env.ENABLE_OBSERVABILITY;

    afterEach(() => {
      process.env.ENABLE_OBSERVABILITY = originalEnv;
    });

    it('returns the operation result on success without error logging', async () => {
      const result = await withStorageLogging(async () => 'upload_success_key', { bucket: 'avatars' });
      expect(result).toBe('upload_success_key');
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('rethrows error and logs when ENABLE_OBSERVABILITY=true', async () => {
      process.env.ENABLE_OBSERVABILITY = 'true';
      const testError = new Error('Upload quota exceeded');

      await expect(
        withStorageLogging(async () => {
          throw testError;
        }, { bucket: 'documents', path: 'org/doc.pdf' })
      ).rejects.toThrow('Upload quota exceeded');

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(errorSpy.mock.calls[0][0]);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Storage operation failed');
      expect(parsed.bucket).toBe('documents');
      expect(parsed.path).toBe('org/doc.pdf');
    });

    it('rethrows error without logging when ENABLE_OBSERVABILITY is false or unset', async () => {
      process.env.ENABLE_OBSERVABILITY = 'false';
      const testError = new Error('Network timeout');

      await expect(
        withStorageLogging(async () => {
          throw testError;
        }, { bucket: 'reports' })
      ).rejects.toThrow('Network timeout');

      expect(errorSpy).not.toHaveBeenCalled();
    });
  });
});
