# Playwright Guidelines

## Overview
Playwright is the standard end-to-end test runner. It is reserved for critical user paths only — not a replacement for unit or integration tests. Tests run in Chromium by default; multi-browser coverage is opt-in per project. Turbo drives E2E runs in CI with optional sharding for parallelism.

## Rules

### [REQUIRED] Test only critical paths
- **What:** E2E tests cover the highest-value user journeys: authentication, primary CRUD flows, checkout/payment, and anything that crosses multiple services. Do not write E2E tests for UI unit behaviour already covered by React Testing Library.
- **Why:** E2E tests are slow and flaky when over-used. A narrow, maintained suite is more valuable than a broad, fragile one.

### [REQUIRED] Place tests under `tests/e2e/`
- **What:** All Playwright spec files live in `apps/<app>/tests/e2e/`. Fixtures and helpers go in `tests/e2e/fixtures/` and `tests/e2e/utils/`.
- **Config:**
  ```
  apps/web/
  ├── playwright.config.ts
  └── tests/
      └── e2e/
          ├── fixtures/
          │   └── app.ts       # extended test object with auth state
          ├── utils/
          │   └── selectors.ts
          ├── auth.spec.ts
          └── dashboard.spec.ts
  ```
- **Why:** Keeps E2E tests separate from Vitest unit/integration tests and makes the Playwright config `testDir` unambiguous.

### [REQUIRED] Use Page Object pattern
- **What:** Encapsulate page interactions in Page Object classes. Specs read as user stories; low-level Playwright calls live in the PO.
- **Config:**
  ```ts
  // tests/e2e/pages/LoginPage.ts
  import type { Page } from '@playwright/test'

  export class LoginPage {
    constructor(private readonly page: Page) {}

    async goto() {
      await this.page.goto('/login')
    }

    async login(email: string, password: string) {
      await this.page.getByLabel('Email').fill(email)
      await this.page.getByLabel('Password').fill(password)
      await this.page.getByRole('button', { name: 'Sign in' }).click()
    }

    async expectDashboard() {
      await this.page.waitForURL('/dashboard')
    }
  }
  ```
  ```ts
  // tests/e2e/auth.spec.ts
  import { test } from '../fixtures/app'
  import { LoginPage } from '../pages/LoginPage'

  test('user can log in with valid credentials', async ({ page }) => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login('user@example.com', 'password')
    await login.expectDashboard()
  })
  ```
- **Why:** Page Objects make specs resilient to UI changes — selector updates happen in one place, not scattered across test files.

### [REQUIRED] `webServer` config to auto-start the app
- **What:** Use `webServer` in `playwright.config.ts` so Playwright starts the app before running tests. Use `reuseExistingServer: !process.env.CI` to avoid double-starts locally.
- **Config:**
  ```ts
  // apps/web/playwright.config.ts
  import { defineConfig, devices } from '@playwright/test'

  export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI
      ? [['github'], ['html', { outputFolder: 'playwright-report' }]]
      : 'list',
    use: {
      baseURL: 'http://localhost:3000',
      trace: 'on-first-retry',
      screenshot: 'only-on-failure',
      video: 'on-first-retry',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
    webServer: {
      command: 'pnpm run build && pnpm run start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  })
  ```
- **Why:** Declarative server management avoids race conditions and manual pre-start steps in CI scripts.

### [REQUIRED] Screenshot and video on failure
- **What:** Set `screenshot: 'only-on-failure'` and `video: 'on-first-retry'` under `use`. Upload `playwright-report/` as a CI artifact.
- **Why:** Failure artifacts are the primary debugging tool for E2E regressions caught only in CI.

### [RECOMMENDED] CI sharding for parallel execution
- **What:** Split the test suite across multiple CI runners using `--shard=N/M`.
- **Config:**
  ```yaml
  # In GitHub Actions (see github-actions.md for full workflow)
  strategy:
    matrix:
      shard: [1, 2, 3]
  steps:
    - run: pnpm exec playwright test --shard=${{ matrix.shard }}/3
  ```
- **Why:** Sharding cuts wall-clock E2E time proportionally to shard count without any test modification.

### [REQUIRED] Turbo integration
- **What:** Register `test:e2e` in `turbo.json`. Do not cache E2E output — tests must always run against a live build.
- **Config:**
  ```json
  // turbo.json
  {
    "tasks": {
      "test:e2e": {
        "dependsOn": ["^build"],
        "cache": false,
        "outputs": ["playwright-report/**"]
      }
    }
  }
  ```
  ```json
  // apps/web/package.json
  {
    "scripts": {
      "test:e2e": "playwright test",
      "test:e2e:ui": "playwright test --ui"
    }
  }
  ```
- **Why:** `dependsOn: ["^build"]` ensures the production build is current before E2E runs; `cache: false` prevents stale passes.

## Configuration

Complete `playwright.config.ts` with auth state reuse:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    // Auth setup project — runs once, saves storage state
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'pnpm run build && pnpm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

## Common Pitfalls

- **Flaky selectors:** Never use CSS class selectors or test-ids from implementation detail attributes. Use `getByRole`, `getByLabel`, `getByText`, and `getByTestId` (with stable `data-testid` values).
- **Over-testing UI details:** E2E tests should verify _that_ a flow works, not _how_ elements look. Visual regression belongs in Storybook/Chromatic, not Playwright.
- **Forgetting `forbidOnly`:** Committed `test.only()` calls silently skip all other tests. `forbidOnly: !!process.env.CI` makes this a hard error in CI.
- **Workers in CI:** Default parallel workers overwhelm a single CI runner; set `workers: 1` or use sharding across multiple runners instead.
- **Missing artifact upload:** If `playwright-report/` is not uploaded as a CI artifact, failure screenshots and traces are lost and debugging becomes guesswork.
