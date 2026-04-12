# Base Monorepo Guidelines

## Overview
Standard monorepo layout using Turborepo v2 (task orchestration + caching) and pnpm workspaces (package management). This combination gives deterministic installs, shared dependency deduplication, and incremental builds with remote caching.

## Rules

### [RECOMMENDED] Use `tasks` key in turbo.json (v2+ syntax)
- **What:** Define all runnable tasks under the top-level `tasks` key. The legacy `pipeline` key from v1 is not supported in v2.
- **Config:**
  ```json
  {
    "$schema": "https://turbo.build/schema.json",
    "tasks": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": ["dist/**", ".next/**"],
        "env": ["NODE_ENV", "NEXT_PUBLIC_API_URL"]
      },
      "lint": {
        "dependsOn": [],
        "outputs": []
      },
      "test": {
        "dependsOn": ["^build"],
        "outputs": ["coverage/**"]
      },
      "format:check": {
        "outputs": []
      },
      "madge": {
        "outputs": []
      },
      "knip": {
        "outputs": []
      },
      "typecheck": {
        "dependsOn": ["^build"],
        "outputs": []
      },
      "dev": {
        "cache": false,
        "persistent": true
      }
    }
  }
  ```
- **Why:** `^build` means "run `build` in all dependencies first." Declaring `env` opts the task into strict environment variable mode, preventing cache pollution from undeclared variables.

### [RECOMMENDED] `pnpm-workspace.yaml` at repo root
- **What:** Declare all workspace package globs here.
- **Config:**
  ```yaml
  packages:
    - "apps/*"
    - "packages/*"
  ```
- **Why:** pnpm reads this file to discover workspaces. Do not duplicate this in `package.json`'s `workspaces` field — pnpm ignores it in favour of `pnpm-workspace.yaml`.

### [RECOMMENDED] Standard package taxonomy
- **What:** Organize packages into predictable categories under `packages/`.
  ```
  packages/
    config/         # Shared tool configs: tsconfig, eslint, prettier
    types/          # Shared TypeScript types and interfaces
    env/            # Environment variable validation (e.g. with zod)
    utils/          # Pure utility functions, no framework dependencies
    logger/         # Logging abstraction (pino, winston, etc.)
    api-contract/   # Shared API types/schemas bridging frontend ↔ backend
    ui/             # Shared React component library
  apps/
    web/            # Frontend (Vite/Next.js)
    api/            # Backend (Fastify/NestJS)
  ```
- **Why:** DB access stays private to `apps/api`. The `api-contract` package is the only cross-boundary type sharing — it prevents duplicating request/response types and keeps the API schema as the single source of truth.

### [RECOMMENDED] Use the workspace protocol for internal deps
- **What:** Reference internal packages with `workspace:*`, not a pinned version.
- **Config:**
  ```json
  {
    "dependencies": {
      "@project/types": "workspace:*",
      "@project/utils": "workspace:*",
      "@project/ui": "workspace:*"
    }
  }
  ```
- **Why:** `workspace:*` tells pnpm to always link the local package. It resolves to the actual version in the lockfile on publish. Never use `"*"` or `"0.0.0"` — they can resolve to a published registry package.

### [RECOMMENDED] Root `package.json` scripts
- **What:** Root scripts delegate to turbo; they do not run tools directly.
- **Config:**
  ```json
  {
    "scripts": {
      "build": "turbo run build",
      "dev": "turbo run dev",
      "lint": "turbo run lint",
      "test": "turbo run test",
      "typecheck": "turbo run typecheck",
      "format:check": "turbo run format:check",
      "format:write": "prettier --write \"**/*.{ts,tsx,js,json,md,yaml}\"",
      "madge": "turbo run madge",
      "knip": "turbo run knip",
      "syncpack:lint": "syncpack lint",
      "syncpack:fix": "syncpack fix"
    }
  }
  ```
- **Why:** Running via `turbo run` ensures tasks execute in dependency order with caching. `format:write` and syncpack scripts run at the root because they operate across the entire repo.

### [SUGGESTED] One component per file
- **What:** Each exported React component, class, or major function lives in its own file.
- **Why:** Enables tree-shaking, improves code navigation, makes barrel imports optional and explicit. Prevents accidental coupling between unrelated exports.

## Architecture Principles

- **DB access is private to `apps/api`**: No package under `packages/` may import a DB client (Prisma, Drizzle, etc.). Keeping DB logic behind an API boundary makes it replaceable and prevents frontend bundles from accidentally pulling in server-only code.
- **`api-contract` bridges the boundary**: Frontend and backend both import from `@project/api-contract`. This package contains only types/schemas (e.g. Zod schemas, TypeScript interfaces) — no runtime logic, no framework imports.
- **Packages must be modular**: A package in `packages/` should have a single clear responsibility. If a package starts importing from another `packages/` entry that creates a cycle, split the shared logic into a third package.

## Common Pitfalls

- Using `pipeline` key in `turbo.json`: This is the v1 syntax and will cause an error in Turborepo v2. Always use `tasks`.
- Forgetting `"^build"` in `dependsOn`: Without it, a package may build before its local dependencies, causing stale type errors.
- Using `workspace:^1.2.3` with a fixed range: In a monorepo you always want the local version. Use `workspace:*`.
- Putting `NODE_ENV` in `passThroughEnv` instead of `env`: Values in `env` are hashed into the cache key. `passThroughEnv` passes the value through without affecting the cache key — only use it for values that do not affect build output (e.g. `CI`, `TURBO_TOKEN`).
- Cross-importing between `apps/`: The `web` app must never import from `apps/api`. All sharing goes through `packages/`.
