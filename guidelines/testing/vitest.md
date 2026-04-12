# Vitest Guidelines

## Overview
Vitest is the standard test runner for all packages and apps in the monorepo. It shares the same Vite config pipeline, making it fast and configuration-light for TypeScript projects. The v8 coverage provider is used because it runs in-process without transpilation overhead.

## Rules

### [REQUIRED] Use workspace config for monorepo
- **What:** Define a `vitest.workspace.ts` at the repo root that discovers all testable packages.
- **Config:**
  ```ts
  // vitest.workspace.ts (repo root)
  import { defineWorkspace } from 'vitest/config'

  export default defineWorkspace([
    'packages/*/vitest.config.ts',
    'apps/*/vitest.config.ts',
  ])
  ```
- **Why:** Running `vitest` from the root discovers all workspaces, and Turbo can still cache per-package by invoking the per-package config directly.

### [REQUIRED] Share base config from packages/config
- **What:** Publish a shared Vitest config factory from `packages/config/vitest.ts` so every package stays consistent.
- **Config:**
  ```ts
  // packages/config/vitest.ts
  import { defineConfig } from 'vitest/config'

  export function createVitestConfig(overrides = {}) {
    return defineConfig({
      test: {
        globals: true,
        environment: 'node',
        coverage: {
          provider: 'v8',
          reporter: ['text', 'lcov', 'html'],
          thresholds: {
            lines: 80,
            functions: 80,
            branches: 75,
            statements: 80,
          },
          exclude: [
            '**/node_modules/**',
            '**/dist/**',
            '**/*.d.ts',
            '**/index.ts', // barrel files
          ],
        },
        ...overrides,
      },
    })
  }
  ```
  ```ts
  // packages/my-lib/vitest.config.ts
  import { createVitestConfig } from '@repo/config/vitest'

  export default createVitestConfig()
  ```
- **Why:** Centralised thresholds mean a single PR enforces coverage policy everywhere.

### [REQUIRED] Use `--run` flag in CI
- **What:** Always invoke Vitest with `--run` in non-interactive environments.
- **Config:**
  ```json
  // package.json (per package)
  {
    "scripts": {
      "test": "vitest --run",
      "test:watch": "vitest"
    }
  }
  ```
- **Why:** Without `--run`, Vitest stays in watch mode and the CI job hangs indefinitely.

### [REQUIRED] Turbo integration
- **What:** Wire the `test` script through Turbo so caching and dependency ordering work.
- **Config:**
  ```json
  // turbo.json
  {
    "tasks": {
      "test": {
        "dependsOn": ["^build"],
        "outputs": ["coverage/**"],
        "cache": true
      }
    }
  }
  ```
- **Why:** Turbo skips test runs whose inputs haven't changed, drastically cutting CI time on large monorepos.

### [RECOMMENDED] Unit tests for packages, integration tests for apps
- **What:** Packages contain pure unit tests (no I/O). Apps contain integration tests that may need real services.
- **Config:**
  ```ts
  // apps/api/vitest.config.ts — integration tests with longer timeout
  import { createVitestConfig } from '@repo/config/vitest'

  export default createVitestConfig({
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: 'node',
  })
  ```
- **Why:** Keeps fast unit feedback loops intact while allowing heavier integration tests where the app boundary is tested.

### [RECOMMENDED] API integration tests against real PostgreSQL
- **What:** Use Docker Compose (or Testcontainers) to spin up PostgreSQL for API integration tests.
- **Config:**
  ```ts
  // apps/api/vitest.config.ts
  import { createVitestConfig } from '@repo/config/vitest'

  export default createVitestConfig({
    testTimeout: 60_000,
    globalSetup: ['./test/setup/db.ts'],
  })
  ```
  ```ts
  // apps/api/test/setup/db.ts
  import { execSync } from 'node:child_process'

  export async function setup() {
    execSync('docker compose -f docker-compose.test.yml up -d --wait', {
      stdio: 'inherit',
    })
    process.env.DATABASE_URL =
      'postgresql://postgres:postgres@localhost:5432/test'
  }

  export async function teardown() {
    execSync('docker compose -f docker-compose.test.yml down -v', {
      stdio: 'inherit',
    })
  }
  ```
- **Why:** Real database tests catch SQL query bugs and migration issues that mocks cannot.

### [RECOMMENDED] React Testing Library for component tests
- **What:** Set `environment: 'jsdom'` and install `@testing-library/react` and `@testing-library/user-event` for UI packages.
- **Config:**
  ```ts
  // packages/ui/vitest.config.ts
  import { createVitestConfig } from '@repo/config/vitest'
  import react from '@vitejs/plugin-react'

  export default createVitestConfig({
    plugins: [react()],
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  })
  ```
  ```ts
  // packages/ui/test/setup.ts
  import '@testing-library/jest-dom'
  ```
- **Why:** jsdom lets component tests run in Node without a browser, keeping them fast and cacheable.

## Configuration

Complete example for a monorepo with a shared UI package and an API app:

```
repo/
├── vitest.workspace.ts          # workspace discovery
├── turbo.json                   # Turbo task config
├── packages/
│   ├── config/
│   │   └── vitest.ts            # shared config factory
│   └── ui/
│       ├── vitest.config.ts     # jsdom environment
│       └── test/setup.ts
└── apps/
    └── api/
        ├── vitest.config.ts     # node + longer timeout
        └── test/setup/db.ts     # PostgreSQL global setup
```

```ts
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
])
```

Running the full suite:
```bash
# Local — watch mode across all workspaces
vitest

# CI — single run via Turbo (cached)
turbo run test
```

## Common Pitfalls

- **Watch mode in CI:** Forgetting `--run` causes the job to hang waiting for input. Always set `"test": "vitest --run"` in `package.json`.
- **Coverage provider mismatch:** Don't mix `@vitest/coverage-istanbul` with `v8` across packages — pick one and enforce it in the shared config.
- **`globals: true` without types:** Add `"types": ["vitest/globals"]` to each package's `tsconfig.json` or use `/// <reference types="vitest/globals" />` to avoid TypeScript errors on `describe`/`it`/`expect`.
- **Turbo not caching:** Ensure `outputs: ["coverage/**"]` is declared in `turbo.json`; otherwise Turbo cannot restore the coverage artifact and the task re-runs every time.
- **Integration tests in unit packages:** If a package imports a real database driver, Turbo may correctly cache a failing test after you fix a db issue. Separate integration tests from unit tests using file naming (`*.integration.test.ts`) and configure `include`/`exclude` patterns in the per-package config.
