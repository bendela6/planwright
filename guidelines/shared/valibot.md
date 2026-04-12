# Valibot Guidelines

## Overview
Valibot is the standard schema validation library for this project, replacing Zod. It uses a functional, tree-shakeable API where each validator is an independently importable function. The result is dramatically smaller bundle sizes (~1KB core vs ~50KB for Zod) — critical for frontend bundles. Valibot is used in three places: the `api-contract` package (shared endpoint definitions), Fastify route validation, and React form validation via react-hook-form.

## Rules

### [REQUIRED] Use `v.pipe()` for composed validations — not chaining
- **What:** Compose multiple validators on a single value using `v.pipe()`.
- **Config:**
  ```typescript
  import * as v from 'valibot';

  // Correct: pipe-based composition
  const EmailSchema = v.pipe(v.string(), v.email(), v.maxLength(254));

  // Correct: transform inside a pipe
  const TrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

  // Wrong: Zod-style chaining doesn't exist in Valibot
  // v.string().email().maxLength(254) — does not work
  ```
- **Why:** Valibot's design is functional — each schema is a plain object, not a class instance. `v.pipe()` composes them. This enables tree-shaking because validators not imported are excluded from the bundle.

### [REQUIRED] Infer TypeScript types with `v.InferInput` and `v.InferOutput`
- **What:** Use `v.InferOutput<typeof Schema>` for the parsed/transformed type, `v.InferInput<typeof Schema>` for the raw input type before transforms.
- **Config:**
  ```typescript
  import * as v from 'valibot';

  const UserSchema = v.object({
    id: v.pipe(v.string(), v.uuid()),
    email: v.pipe(v.string(), v.email()),
    age: v.pipe(v.number(), v.minValue(0)),
    name: v.optional(v.string()),
  });

  // Output type after parsing (transforms applied)
  type User = v.InferOutput<typeof UserSchema>;

  // Input type before parsing (useful for form values)
  type UserInput = v.InferInput<typeof UserSchema>;
  ```
- **Why:** When transforms exist (e.g., string → Date), `InferInput` and `InferOutput` differ. Using `InferOutput` in application logic ensures you work with the fully-validated, transformed type.

### [REQUIRED] Parse with `v.parse()` for throwing, `v.safeParse()` for error handling
- **What:** Use `v.parse()` where a validation failure is a programming error (server response parsing). Use `v.safeParse()` where failure is expected user input.
- **Config:**
  ```typescript
  // Throws ValiError on failure — use at API boundary where failure = bug
  const user = v.parse(UserSchema, rawData);

  // Returns { success, output, issues } — use for form/request validation
  const result = v.safeParse(UserSchema, formData);
  if (!result.success) {
    const errors = result.issues.map(i => ({ path: i.path?.[0]?.key, message: i.message }));
    return { errors };
  }
  const validData = result.output;
  ```
- **Why:** `v.parse()` throws a `ValiError` with structured `issues`. `v.safeParse()` returns a discriminated union — no try/catch needed, making control flow explicit.

### [REQUIRED] Define the `api-contract` package with Valibot schemas for every endpoint
- **What:** The shared `packages/api-contract` package defines every API endpoint with its path, method, and request/response schemas using Valibot.
- **Config:**
  ```typescript
  // packages/api-contract/src/endpoints/users.ts
  import * as v from 'valibot';

  export const GetUserSchema = {
    path: '/users/:id',
    method: 'GET' as const,
    params: v.object({ id: v.pipe(v.string(), v.uuid()) }),
    response: v.object({
      id: v.pipe(v.string(), v.uuid()),
      email: v.pipe(v.string(), v.email()),
      name: v.string(),
      createdAt: v.pipe(v.string(), v.isoTimestamp()),
    }),
  };

  export const CreateUserSchema = {
    path: '/users',
    method: 'POST' as const,
    body: v.object({
      email: v.pipe(v.string(), v.email()),
      name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
      password: v.pipe(v.string(), v.minLength(8)),
    }),
    response: v.object({
      id: v.pipe(v.string(), v.uuid()),
      email: v.pipe(v.string(), v.email()),
    }),
  };

  export type CreateUserBody = v.InferInput<typeof CreateUserSchema.body>;
  export type CreateUserResponse = v.InferOutput<typeof CreateUserSchema.response>;
  ```
- **Why:** A single source of truth for request/response shapes eliminates drift between frontend fetch calls and backend route handlers. Both sides import from `@project/api-contract`.

### [REQUIRED] Integrate Valibot schemas with Fastify route validation
- **What:** Use `@valibot/to-json-schema` to convert Valibot schemas to JSON Schema for Fastify's built-in validation and serialization.
- **Config:**
  ```typescript
  import Fastify from 'fastify';
  import * as v from 'valibot';
  import { toJsonSchema } from '@valibot/to-json-schema';
  import { CreateUserSchema } from '@project/api-contract';

  const app = Fastify();

  app.post('/users', {
    schema: {
      body: toJsonSchema(CreateUserSchema.body),
      response: { 200: toJsonSchema(CreateUserSchema.response) },
    },
    handler: async (request) => {
      // request.body is validated; cast is safe
      const body = request.body as v.InferInput<typeof CreateUserSchema.body>;
      const parsed = v.parse(CreateUserSchema.body, body);
      // ... create user
      return parsed;
    },
  });
  ```
- **Why:** Fastify uses JSON Schema for its AJV-based validation pipeline. `@valibot/to-json-schema` bridges Valibot and JSON Schema, keeping the contract as the single source of truth.

### [REQUIRED] Use Valibot with react-hook-form via `@hookform/resolvers/valibot`
- **What:** Replace `zodResolver` with `valibotResolver` in Shadcn form components.
- **Config:**
  ```typescript
  import { useForm } from 'react-hook-form';
  import { valibotResolver } from '@hookform/resolvers/valibot';
  import * as v from 'valibot';
  import { CreateUserSchema } from '@project/api-contract';

  type FormValues = v.InferInput<typeof CreateUserSchema.body>;

  export function CreateUserForm() {
    const form = useForm<FormValues>({
      resolver: valibotResolver(CreateUserSchema.body),
      defaultValues: { email: '', name: '', password: '' },
    });

    return (
      <Form {...form}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </Form>
    );
  }
  ```
- **Why:** Using `CreateUserSchema.body` directly in the form resolver means the form validates against the same schema as the API. No duplication, no drift.

### [RECOMMENDED] Use `v.custom()` for domain-specific validators
- **What:** Implement domain rules that built-in validators don't cover using `v.custom()`.
- **Config:**
  ```typescript
  // A slug must be lowercase alphanumeric with hyphens only
  const SlugSchema = v.pipe(
    v.string(),
    v.custom((val) => /^[a-z0-9-]+$/.test(val as string), 'Must be a valid slug'),
    v.minLength(2),
    v.maxLength(60)
  );

  // A transform: parse a numeric string into a number
  const NumericStringSchema = v.pipe(
    v.string(),
    v.transform((val) => Number(val)),
    v.number(),
    v.minValue(0)
  );
  ```
- **Why:** `v.custom()` receives the value and a context; returning `false` or throwing triggers a validation failure with the provided message. Keeps domain rules colocated with the schema.

## Configuration

Common schema patterns reference:

```typescript
import * as v from 'valibot';

// Primitives
const Id       = v.pipe(v.string(), v.uuid());
const Email    = v.pipe(v.string(), v.email(), v.maxLength(254));
const Url      = v.pipe(v.string(), v.url());
const IsoDate  = v.pipe(v.string(), v.isoTimestamp());
const PosInt   = v.pipe(v.number(), v.integer(), v.minValue(1));

// Optionals and nullables
const MaybeName    = v.optional(v.string());           // undefined | string
const NullableName = v.nullable(v.string());           // null | string
const NullishName  = v.nullish(v.string());            // null | undefined | string

// Arrays and objects
const TagsSchema = v.array(v.pipe(v.string(), v.minLength(1)));
const PaginationSchema = v.object({
  page:    v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), 1),
  perPage: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)), 20),
});

// Unions and literals
const RoleSchema   = v.union([v.literal('admin'), v.literal('user'), v.literal('viewer')]);
const StatusSchema = v.picklist(['active', 'inactive', 'pending']);
```

## Common Pitfalls

- **Using old array-based API**: Valibot v1.x removed `v.string([v.email()])`. The correct syntax is `v.pipe(v.string(), v.email())`. The old API throws at runtime.
- **Using `InferInput` everywhere**: Forms use `InferInput` (pre-transform); domain logic uses `InferOutput` (post-transform). Mixing them causes type errors when transforms exist (e.g., a string-to-Date transform).
- **Forgetting `@valibot/to-json-schema` for Fastify**: Fastify's AJV validator does not understand Valibot schema objects directly. Always convert via `toJsonSchema()` in the route schema option.
- **Sharing Zod and Valibot in the same project**: The bundle cost adds up. When migrating, replace all Zod schemas in one pass rather than running both in parallel.
- **Not exporting inferred types from `api-contract`**: Consumers of `@project/api-contract` need both the schema (for `v.parse()`) and the type (for TypeScript). Export both from each contract module.
- **Valibot vs Zod summary**: Valibot's functional API enables per-validator tree-shaking. Zod's fluent API (method chaining) is incompatible with tree-shaking because validators are class methods. For a frontend bundle, the difference is ~49KB gzipped.
