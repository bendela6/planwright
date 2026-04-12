# Drizzle ORM Guidelines

## Overview
Drizzle ORM is the standard data access layer for all services in this monorepo. It provides
type-safe SQL queries with zero runtime overhead, excellent TypeScript inference, and a
migration workflow driven by `drizzle-kit`. The database client is **private to the API** —
no other app or package imports from `apps/api/src/db/`.

## Rules

### [REQUIRED] Schema files live in `apps/api/src/db/schema/` — one file per domain
- **What:** Each table (or closely related group of tables) gets its own file. An `index.ts`
  re-exports everything for use by the client and migrations.
- **Config:**
  ```ts
  // apps/api/src/db/schema/users.ts
  import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';

  export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  });

  // apps/api/src/db/schema/index.ts
  export * from './users.js';
  export * from './orders.js';
  ```
- **Why:** Small files are easier to review in PRs; re-exporting via `index.ts` gives the
  migration tool a single entry point.

### [REQUIRED] Define relations explicitly
- **What:** Use `relations()` from `drizzle-orm` to describe foreign-key relationships. Do
  not rely on column naming conventions alone.
- **Config:**
  ```ts
  // apps/api/src/db/schema/orders.ts
  import { pgTable, uuid, text, timestamp, numeric } from 'drizzle-orm/pg-core';
  import { relations } from 'drizzle-orm';
  import { users } from './users.js';

  export const orders = pgTable('orders', {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: ['pending', 'confirmed', 'shipped', 'cancelled'] })
      .notNull()
      .default('pending'),
    totalCents: numeric('total_cents', { precision: 12, scale: 0 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  });

  export const ordersRelations = relations(orders, ({ one }) => ({
    user: one(users, { fields: [orders.userId], references: [users.id] }),
  }));

  export const usersRelations = relations(users, ({ many }) => ({
    orders: many(orders),
  }));
  ```
- **Why:** Relations enable Drizzle's `with` clause for eager loading without raw joins.

### [REQUIRED] Single `db.ts` — export one configured client instance
- **What:** All database access goes through the singleton exported from `db.ts`. No other
  file creates a Postgres connection.
- **Config:**
  ```ts
  // apps/api/src/db/db.ts
  import { drizzle } from 'drizzle-orm/node-postgres';
  import { Pool } from 'pg';
  import * as schema from './schema/index.js';

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX ?? '10', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV !== 'production' });
  export type Db = typeof db;
  ```
- **Why:** Prevents connection pool exhaustion; makes it trivial to inject a test DB instance.

### [REQUIRED] Use `$inferSelect` and `$inferInsert` for type inference
- **What:** Derive TypeScript types directly from the schema definition. Do not duplicate
  types manually.
- **Config:**
  ```ts
  // apps/api/src/db/types.ts
  import { users, orders } from './schema/index.js';

  export type User = typeof users.$inferSelect;
  export type NewUser = typeof users.$inferInsert;
  export type Order = typeof orders.$inferSelect;
  export type NewOrder = typeof orders.$inferInsert;
  ```
- **Why:** Types stay in sync with the schema automatically; no divergence between runtime
  columns and TypeScript interfaces.

### [REQUIRED] Migration workflow: `generate` then `migrate` — never `push` in production
- **What:** Use `drizzle-kit generate` to create a migration SQL file, review it, then run
  `drizzle-kit migrate` to apply it. `db:push` is only acceptable for local throwaway DBs.
- **Config:**
  ```jsonc
  // package.json scripts
  {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:push": "drizzle-kit push"  // local dev only
  }
  ```
- **Why:** Generated migration files are committed to source control, making DB changes
  reviewable, reversible, and auditable.

### [REQUIRED] `drizzle.config.ts` at repo root (or `apps/api/`)
- **Config:**
  ```ts
  // apps/api/drizzle.config.ts
  import { defineConfig } from 'drizzle-kit';

  export default defineConfig({
    dialect: 'postgresql',
    schema: './src/db/schema/index.ts',
    out: './src/db/migrations',
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true,
  });
  ```
- **Why:** `strict: true` prompts for confirmation on destructive changes; `verbose` logs
  every SQL statement during migration.

### [REQUIRED] Use transactions for multi-table writes
- **What:** Any operation that writes to more than one table must be wrapped in
  `db.transaction()`.
- **Config:**
  ```ts
  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values(newUser).returning();
    await tx.insert(accounts).values({ userId: user.id, balance: 0 });
    return user;
  });
  ```
- **Why:** Prevents partial writes that leave the database in an inconsistent state.

## Configuration

Complete query pattern reference:

```ts
import { db } from '../db/db.js';
import { users, orders } from '../db/schema/index.js';
import { eq, and, desc, sql } from 'drizzle-orm';

// SELECT with relation
const userWithOrders = await db.query.users.findFirst({
  where: eq(users.id, userId),
  with: { orders: { orderBy: desc(orders.createdAt), limit: 10 } },
});

// INSERT returning
const [created] = await db.insert(users).values({ email, name }).returning();

// UPDATE
await db
  .update(users)
  .set({ name: newName, updatedAt: new Date() })
  .where(eq(users.id, userId));

// DELETE
await db.delete(users).where(eq(users.id, userId));

// Paginated SELECT
const page = await db
  .select()
  .from(users)
  .orderBy(desc(users.createdAt))
  .limit(20)
  .offset((pageNumber - 1) * 20);
```

## Seed Scripts

```ts
// apps/api/src/db/seed.ts
import { db } from './db.js';
import { users } from './schema/index.js';

async function seed() {
  await db.delete(users); // clean slate
  await db.insert(users).values([
    { email: 'alice@example.com', name: 'Alice' },
    { email: 'bob@example.com', name: 'Bob' },
  ]);
  console.log('Seed complete');
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
```

Add to `package.json`: `"db:seed": "tsx src/db/seed.ts"`.

## Common Pitfalls

- **Using `db push` in CI or production** — `push` does not create migration files and cannot
  be rolled back. Only use it for local throwaway databases.
- **Forgetting `.returning()` on insert** — Drizzle's `insert` does not return the created
  row by default (unlike some ORMs). Always chain `.returning()` when you need the ID.
- **Accessing `db` from packages outside the API** — the DB client and schema are internal to
  `apps/api`. Other apps consume data via the API's HTTP interface, not by importing `db`.
- **Missing `withTimezone: true` on timestamps** — without it, Postgres stores as `timestamp`
  (no timezone). Always use `{ withTimezone: true }` to avoid DST ambiguity.
- **Not running `db:generate` after schema changes** — changed schema files do not
  automatically update the database. Always generate and commit migration files.
- **Mutating `$inferSelect` types** — treat inferred types as read-only DTOs. If you need a
  writable subset, use `Partial<NewUser>` or pick from the base type.
