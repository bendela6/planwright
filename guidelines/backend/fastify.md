# Fastify Guidelines

## Overview
Fastify is the primary HTTP framework for new API services. It is chosen for its schema-first
validation, low overhead, excellent TypeScript support, and plugin-based encapsulation model.
All new backend services use Fastify; NestJS is only used when auditing existing apps.

## Rules

### [REQUIRED] Use TypeScript with full type inference on routes
- **What:** Declare request/reply generics on every route so the handler body is fully typed.
- **Config:**
  ```ts
  import Fastify from 'fastify';
  const app = Fastify({ logger: true });

  app.get<{ Params: { id: string }; Reply: UserDto }>(
    '/users/:id',
    { schema: getUserSchema },
    async (request, reply) => {
      const user = await userService.findById(request.params.id);
      return reply.send(user);
    },
  );
  ```
- **Why:** Catches mismatches between schema and handler at compile time, not runtime.

### [REQUIRED] Plugin-based architecture — never register routes on the root instance
- **What:** Wrap every domain's routes in a Fastify plugin registered with `fastify.register()`.
  Use `fastify-plugin` (`fp`) only when you need to expose decorators/services to sibling plugins.
- **Config:**
  ```ts
  // routes/users/index.ts
  import { FastifyPluginAsync } from 'fastify';

  const usersRoutes: FastifyPluginAsync = async (fastify) => {
    fastify.get('/users', { schema: listUsersSchema }, listUsersHandler);
    fastify.post('/users', { schema: createUserSchema }, createUserHandler);
    fastify.get('/users/:id', { schema: getUserSchema }, getUserHandler);
  };

  export default usersRoutes;
  ```
- **Why:** Encapsulation isolates error handling and hooks per domain; `fp` lifts the plugin
  out of Fastify's scope when shared decorators are needed.

### [REQUIRED] Validate all input with JSON Schema derived from Valibot schemas
- **What:** Define Valibot schemas in the api-contract package; convert them to JSON Schema
  for Fastify's `schema` option using `@valibot/to-json-schema`.
- **Config:**
  ```ts
  // packages/api-contract/src/users.ts
  import * as v from 'valibot';

  export const CreateUserBody = v.object({
    email: v.pipe(v.string(), v.email()),
    name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  });

  export type CreateUserBodyType = v.InferOutput<typeof CreateUserBody>;

  // routes/users/schemas.ts
  import { toJsonSchema } from '@valibot/to-json-schema';
  import { CreateUserBody } from '@repo/api-contract';

  export const createUserSchema = {
    body: toJsonSchema(CreateUserBody),
    response: { 201: toJsonSchema(UserResponse) },
  };
  ```
- **Why:** Single source of truth for request/response shape shared across client and server.

### [REQUIRED] Register a custom error handler
- **What:** Use `fastify.setErrorHandler` at the app level to normalise all errors into a
  consistent JSON shape before they reach the client.
- **Config:**
  ```ts
  // plugins/error-handler.ts
  import { FastifyError, FastifyPluginAsync } from 'fastify';
  import fp from 'fastify-plugin';

  const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.setErrorHandler((error, request, reply) => {
      const statusCode = error.statusCode ?? 500;
      if (statusCode >= 500) {
        request.log.error({ err: error }, 'Unhandled error');
      }
      reply.status(statusCode).send({
        error: error.name ?? 'InternalServerError',
        message: statusCode < 500 ? error.message : 'Internal Server Error',
        statusCode,
      });
    });
  };

  export default fp(errorHandlerPlugin, { name: 'error-handler' });
  ```
- **Why:** Prevents internal stack traces from leaking; keeps error shape predictable.

### [REQUIRED] Use hooks for authentication — `onRequest` or `preHandler`
- **What:** Attach auth checks via `preHandler` on individual routes or via `onRequest` on
  a scoped plugin. Never inline auth logic in route handlers.
- **Config:**
  ```ts
  // plugins/auth.ts
  import fp from 'fastify-plugin';
  import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';

  const authPlugin: FastifyPluginAsync = async (fastify) => {
    fastify.decorate(
      'authenticate',
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch (err) {
          reply.send(err);
        }
      },
    );
  };

  export default fp(authPlugin, { name: 'auth' });

  // In a protected route plugin:
  fastify.addHook('onRequest', fastify.authenticate);
  ```
- **Why:** Centralised, testable auth that Fastify's hook lifecycle enforces before handlers run.

### [REQUIRED] Configure CORS via `@fastify/cors`
- **What:** Register `@fastify/cors` with an explicit origin allowlist. Never use `origin: true`
  in production.
- **Config:**
  ```ts
  // plugins/cors.ts
  import cors from '@fastify/cors';
  import fp from 'fastify-plugin';

  export default fp(async (fastify) => {
    await fastify.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    });
  }, { name: 'cors' });
  ```
- **Why:** Prevents unintended cross-origin access; credentials require explicit origin list.

### [REQUIRED] Expose a health check endpoint
- **What:** `GET /health` must return `{ status: 'ok', uptime: number }` with HTTP 200.
  Register it outside any auth-protected scope.
- **Config:**
  ```ts
  fastify.get('/health', { schema: { response: { 200: healthSchema } } }, async () => ({
    status: 'ok',
    uptime: process.uptime(),
  }));
  ```
- **Why:** Required by load balancers, container orchestrators, and uptime monitors.

### [REQUIRED] Implement graceful shutdown
- **What:** Listen for `SIGTERM`/`SIGINT` and call `fastify.close()` before the process exits.
- **Config:**
  ```ts
  // src/index.ts
  const signals = ['SIGTERM', 'SIGINT'] as const;
  for (const signal of signals) {
    process.once(signal, async () => {
      try {
        await app.close();
        process.exit(0);
      } catch (err) {
        app.log.error(err);
        process.exit(1);
      }
    });
  }
  ```
- **Why:** Allows in-flight requests to complete and DB connections to close cleanly.

## Configuration

Complete `src/app.ts` bootstrap example:

```ts
import Fastify from 'fastify';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import usersRoutes from './routes/users/index.js';
import ordersRoutes from './routes/orders/index.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      ...(process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
    ajv: {
      customOptions: { removeAdditional: 'all', coerceTypes: 'array' },
    },
  });

  // Core plugins (order matters)
  await app.register(corsPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(authPlugin);

  // Domain routes (health check registered before prefix routes — no auth)
  await app.register(usersRoutes, { prefix: '/api/v1' });
  await app.register(ordersRoutes, { prefix: '/api/v1' });

  return app;
}
```

## File Structure

```
apps/api/src/
├── app.ts              # buildApp() factory
├── index.ts            # entry point — start server, register signals
├── plugins/
│   ├── auth.ts         # JWT verify decorator
│   ├── cors.ts         # @fastify/cors registration
│   └── error-handler.ts
├── routes/
│   ├── users/
│   │   ├── index.ts    # plugin, registers handlers
│   │   ├── handlers.ts # async handler functions
│   │   └── schemas.ts  # Fastify JSON Schema objects
│   └── orders/
│       ├── index.ts
│       ├── handlers.ts
│       └── schemas.ts
├── db/                 # Drizzle client + schema (see drizzle.md)
├── middleware/         # Any custom Fastify decorators / hooks
└── utils/              # Pure helpers
```

## Common Pitfalls

- **Forgetting `await` on `fastify.register()`** — plugins will appear to load but hooks and
  decorators won't be available to later plugins. Always `await` or return the chain.
- **Using `fastify-cors` instead of `@fastify/cors`** — the old package is deprecated. Use the
  scoped `@fastify/cors`.
- **Setting `origin: true`** — reflects every origin; never do this in production.
- **Wrapping with `fp` unnecessarily** — only use `fastify-plugin` when the plugin must share
  its decorators with sibling plugins. Route-only plugins should stay encapsulated.
- **Throwing `new Error()` in handlers** — throw `createError` from `@fastify/error` or use
  `reply.status(400).send(...)` so the error handler receives a proper `FastifyError` with
  `statusCode`.
- **Reading `request.body` after calling `reply.send()`** — `send` is async; await it or return
  from the handler immediately after.
