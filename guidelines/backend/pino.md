# Pino Logger Guidelines

## Overview
Pino is the standard logger for all backend services. It is chosen for its very low overhead
(fastest of the major Node.js loggers), structured JSON output that works well with log
aggregation systems (Datadog, Loki, CloudWatch), and first-class Fastify integration. All
services consume the shared `@repo/logger` package rather than configuring Pino independently.

## Rules

### [REQUIRED] JSON output in production, pretty-print in development
- **What:** Use `pino.transport()` (not the removed `prettyPrint` option) to conditionally
  attach `pino-pretty` in non-production environments.
- **Config:**
  ```ts
  // packages/logger/src/index.ts
  import pino from 'pino';

  const isDev = process.env.NODE_ENV !== 'production';

  export const logger = pino(
    {
      level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token'],
        censor: '[REDACTED]',
      },
      base: { service: process.env.SERVICE_NAME ?? 'api' },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    isDev
      ? pino.transport({ target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } })
      : undefined, // stdout JSON in production
  );

  export type Logger = typeof logger;
  ```
- **Why:** Human-readable output accelerates local development; structured JSON is required
  for machine-parseable log aggregation in production.

### [REQUIRED] Log levels — use them semantically
- **What:** Every log call must use the appropriate level. Never use `console.log`.

  | Level   | When to use |
  |---------|-------------|
  | `trace` | Verbose internals — DB query parameters, loop iterations. Disabled in production. |
  | `debug` | Diagnostic info useful during development — resolved config, feature flags. |
  | `info`  | Normal operational events — server started, request handled, job completed. |
  | `warn`  | Unexpected but recoverable situations — deprecated config, retried request. |
  | `error` | Errors that need attention but don't crash the process. Include `err` object. |
  | `fatal` | Unrecoverable errors immediately before process exit. |

- **Config:**
  ```ts
  logger.info({ userId }, 'User login succeeded');
  logger.warn({ attempt }, 'Rate limit threshold approaching');
  logger.error({ err, userId }, 'Failed to send welcome email');
  ```
- **Why:** Consistent levels make alert rules and log filters reliable across services.

### [REQUIRED] Always pass the `err` object as a structured field
- **What:** When logging errors, pass the error as `{ err }` — not as a string or in the
  message. Pino serialises `err` using its built-in error serializer.
- **Config:**
  ```ts
  // Correct
  logger.error({ err }, 'Database query failed');

  // Wrong — loses stack trace
  logger.error(`Database query failed: ${err.message}`);
  ```
- **Why:** The error serialiser extracts `message`, `stack`, `name`, and `code` as
  queryable fields in log aggregation.

### [REQUIRED] Use child loggers for request-scoped context
- **What:** In every request handler (or middleware), derive a child logger with the
  `requestId` and any other relevant context. Pass child loggers down the call stack
  instead of the root logger.
- **Config:**
  ```ts
  // In a Fastify preHandler or hook:
  const reqLogger = logger.child({ requestId: request.id, userId: request.user?.id });
  reqLogger.info('Processing create-order request');

  // Pass to service:
  await ordersService.create(dto, reqLogger);
  ```
- **Why:** Every log line emitted during a request carries the request ID, making it trivial
  to filter all logs for a single request in Datadog / Loki.

### [REQUIRED] Fastify integration — use built-in logger, not a separate instance
- **What:** Pass the logger (or its config) to the `Fastify()` constructor. Fastify
  automatically creates a child logger per request and attaches it as `request.log`.
- **Config:**
  ```ts
  // apps/api/src/app.ts
  import { logger } from '@repo/logger';

  const app = Fastify({ loggerInstance: logger });

  // In route handlers, always use request.log — never the root logger:
  app.get('/users/:id', async (request) => {
    request.log.info({ userId: request.params.id }, 'Fetching user');
    // ...
  });
  ```
- **Why:** `request.log` is a child logger pre-bound with `reqId`; using it gives every log
  line a request correlation ID for free.

### [REQUIRED] NestJS integration via `nestjs-pino`
- **What:** In NestJS apps, replace the built-in logger with `nestjs-pino`. Configure it in
  `AppModule` using the same shared logger options.
- **Config:**
  ```ts
  // app.module.ts
  import { LoggerModule } from 'nestjs-pino';

  @Module({
    imports: [
      LoggerModule.forRoot({
        pinoHttp: {
          logger,  // re-use the shared @repo/logger instance
          autoLogging: { ignore: (req) => req.url === '/health' },
          serializers: {
            req: (req) => ({ method: req.method, url: req.url, id: req.id }),
          },
        },
      }),
    ],
  })
  export class AppModule {}

  // In services, inject PinoLogger:
  import { PinoLogger } from 'nestjs-pino';

  @Injectable()
  export class UsersService {
    constructor(private readonly logger: PinoLogger) {
      this.logger.setContext(UsersService.name);
    }
  }
  ```
- **Why:** `nestjs-pino` integrates with Nest's DI and lifecycle; it replaces `console.log`
  calls emitted by Nest itself.

### [REQUIRED] Redact sensitive fields
- **What:** Configure the `redact` option in the root logger to censor secrets before they
  reach any transport.
- **Config:**
  ```ts
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.creditCard',
      '*.token',
      '*.secret',
      '*.apiKey',
    ],
    censor: '[REDACTED]',
  }
  ```
- **Why:** Logs are often shipped to third-party aggregators. Redacting at the logger level
  prevents PII/secrets from ever leaving the process in plaintext.

### [RECOMMENDED] Suppress health-check noise
- **What:** Auto-logging of `GET /health` generates useless noise at high request rates.
  Disable it via the `autoLogging` option.
- **Config (Fastify):**
  ```ts
  const app = Fastify({
    loggerInstance: logger,
    disableRequestLogging: false, // keep default; suppress per-route below
  });

  // Or configure pino-http's ignore:
  // autoLogging: { ignore: (req) => req.url === '/health' }
  ```
- **Why:** Health checks occur every few seconds; logging each one pollutes dashboards and
  increases ingestion costs.

## Configuration

Complete `packages/logger/src/index.ts`:

```ts
import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

const transport = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: process.env.SERVICE_NAME ?? 'api',
      env: process.env.NODE_ENV ?? 'development',
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        '*.token',
        '*.secret',
        '*.apiKey',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
  },
  transport,
);

export type Logger = typeof logger;
```

`packages/logger/package.json` exports:
```json
{
  "name": "@repo/logger",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }
}
```

## Common Pitfalls

- **Using `prettyPrint` option** — this option was removed in Pino v7. Use `pino.transport()`
  with `pino-pretty` as the target instead.
- **Logging errors as strings** — `logger.error(err.message)` discards the stack trace.
  Always pass the error as `{ err }`.
- **Creating a new `pino()` instance per module** — this bypasses the shared config
  (redaction, level, base fields). Import from `@repo/logger` everywhere.
- **Using `logger` directly in route handlers instead of `request.log`** — the root logger
  has no request context. Always use the request-scoped child logger.
- **Setting `LOG_LEVEL=trace` in production** — trace-level logging is extremely verbose and
  can impact throughput. Keep production at `info` and use dynamic level switching if needed.
- **Forgetting `ignore: 'pid,hostname'` in pino-pretty** — these fields are redundant in
  local output and add visual noise.
