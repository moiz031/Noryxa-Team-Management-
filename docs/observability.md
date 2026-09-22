# Observability Foundation

## Overview

The project uses a zero-dependency structured logger in `src/lib/observability/logger.ts`. Logs are emitted as JSON lines to stdout/stderr so the hosting platform can capture them without requiring an external monitoring provider.

## Log schema

Each entry can include:

- `timestamp` (ISO-8601)
- `level` (`debug`, `info`, `warn`, or `error`)
- `message`
- request context such as `requestId`, method, URL, and bounded entity identifiers
- a redacted error/context object where appropriate

## Redaction

The logger redacts password, token, secret, authorization, cookie, API-key, and service-role fields recursively. It also limits recursive traversal depth to prevent unbounded metadata expansion.

## Enabling logs

Set `ENABLE_OBSERVABILITY=true` for API request/error logging. The logger itself remains safe to import in server code and has no third-party runtime dependency.

## Integration points

- API wrapper: request start, handler failures, and audit-log failures.
- Automation, database, storage, and authentication monitors: operational failure context.
- Background jobs: execution lifecycle and retry diagnostics.

## Verification

Redaction behavior is covered by `tests/unit/observability.test.ts`. Run `npm test -- --runInBand` to execute it. Production logs must still be reviewed through the actual hosting provider; this repository does not claim an external monitoring service is configured.
