# GitHub Actions Guidelines

## Overview
GitHub Actions is the standard CI/CD platform. Every PR and push to `main` runs the full quality suite through Turbo. The pipeline validates types, linting, formatting, dependency graph, unused exports, tests (with real PostgreSQL), and optionally E2E tests via Playwright sharding. Docker build verification runs on every merge to `main`.

## Rules

### [REQUIRED] Use `pnpm/action-setup@v4` for pnpm
- **What:** Install pnpm via the official action before `actions/setup-node`.
- **Config:**
  ```yaml
  - uses: pnpm/action-setup@v4
    with:
      run_install: false
  ```
- **Why:** `corepack` is non-deterministic about which version it installs unless the `packageManager` field is set; the action reads that field and pins the version reliably.

### [REQUIRED] `actions/setup-node@v4` with pnpm cache
- **What:** Use the `cache: 'pnpm'` option so the pnpm store is persisted across runs.
- **Config:**
  ```yaml
  - uses: actions/setup-node@v4
    with:
      node-version: 22
      cache: 'pnpm'
  ```
- **Why:** Restoring the pnpm content-addressable store turns a full `pnpm install` into a near-instant `pnpm install --frozen-lockfile` on cache hit.

### [REQUIRED] Concurrency — cancel in-progress runs on same PR
- **What:** Add a `concurrency` block at the workflow level to cancel a superseded run when a new commit is pushed.
- **Config:**
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```
- **Why:** Without this, pushing two commits quickly queues two full CI runs. The first is wasted compute and delays feedback on the second.

### [REQUIRED] Full quality suite via Turbo
- **What:** Run all quality tasks in a single Turbo invocation so Turbo can parallelise and cache.
- **Config:**
  ```yaml
  - name: Quality suite
    run: turbo run tsc lint format:check madge knip test
  ```
- **Why:** Turbo infers task dependencies from `turbo.json` and skips unchanged packages, cutting average CI time on incremental PRs dramatically.

### [REQUIRED] `syncpack lint` at repo root
- **What:** Run `syncpack lint` separately before Turbo (it operates on the root, not per-package).
- **Config:**
  ```yaml
  - name: Check dependency versions
    run: pnpm syncpack lint
  ```
- **Why:** `syncpack` catches version mismatches across `package.json` files that Turbo cannot detect.

### [REQUIRED] PostgreSQL service container for API tests
- **What:** Declare a `services` block so PostgreSQL is available to API integration tests.
- **Config:**
  ```yaml
  services:
    postgres:
      image: postgres:17-alpine
      env:
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: postgres
        POSTGRES_DB: test
      ports:
        - 5432:5432
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
  ```
- **Why:** Service containers are started and health-checked before your job steps run, eliminating manual `docker compose up` + `sleep` workarounds.

### [RECOMMENDED] Playwright with `--shard` for parallel E2E
- **What:** Run Playwright in a matrix job with `--shard=N/M` to parallelize across runners.
- **Config:**
  ```yaml
  strategy:
    matrix:
      shard: [1, 2, 3]
  steps:
    - run: pnpm exec playwright test --shard=${{ matrix.shard }}/3
  ```
- **Why:** Sharding cuts wall-clock E2E time by 1/N without test changes. Merge reports with `playwright merge-reports` afterward.

### [RECOMMENDED] Docker build verification on main
- **What:** Run `docker build` with `--target runner` on every push to `main` (not every PR) to catch Dockerfile regressions.
- **Config:**
  ```yaml
  - name: Verify Docker build
    if: github.ref == 'refs/heads/main'
    run: docker build --target runner -f apps/api/Dockerfile .
  ```
- **Why:** A broken Dockerfile only fails at deploy time without this step, causing production outages.

## Configuration

Complete `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  # ── Quality + Unit/Integration Tests ─────────────────────────────────────
  ci:
    name: CI
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check dependency version consistency
        run: pnpm syncpack lint

      - name: Quality suite (tsc, lint, format, madge, knip, test)
        run: pnpm turbo run tsc lint format:check madge knip test

      - name: Verify Docker build
        if: github.ref == 'refs/heads/main'
        run: docker build --target runner -f apps/api/Dockerfile .

  # ── E2E Tests (Playwright, sharded) ──────────────────────────────────────
  e2e:
    name: E2E (${{ matrix.shard }}/3)
    runs-on: ubuntu-latest
    # Only run E2E on PRs to main and pushes to main
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/main'

    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3]

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build app
        run: pnpm turbo run build --filter=web

      - name: Run Playwright tests (shard ${{ matrix.shard }}/3)
        run: pnpm exec playwright test --shard=${{ matrix.shard }}/3
        working-directory: apps/web
        env:
          CI: true

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report-shard-${{ matrix.shard }}
          path: apps/web/playwright-report/
          retention-days: 7

  # ── Merge Playwright reports ──────────────────────────────────────────────
  e2e-report:
    name: Merge E2E Reports
    runs-on: ubuntu-latest
    needs: e2e
    if: always()

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          run_install: false

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Download all shard reports
        uses: actions/download-artifact@v4
        with:
          pattern: playwright-report-shard-*
          path: all-reports/

      - name: Merge reports
        run: pnpm exec playwright merge-reports --reporter html ./all-reports
        working-directory: apps/web

      - name: Upload merged report
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report-merged
          path: apps/web/playwright-report/
          retention-days: 30
```

## Common Pitfalls

- **Forgetting `--frozen-lockfile`:** Using `pnpm install` without `--frozen-lockfile` in CI can silently update `pnpm-lock.yaml` and commit mismatches back to the branch. Always freeze installs in CI.
- **Turbo remote cache misconfiguration:** If `TURBO_TOKEN` and `TURBO_TEAM` are not set, Turbo falls back to local cache (empty on a fresh runner). Set these secrets to enable remote caching.
- **Service container port mapping:** Service containers on GitHub Actions are accessed via `localhost:<mapped-port>`, not the service name. Ensure `DATABASE_URL` uses `localhost:5432`, not `postgres:5432`.
- **E2E and CI in the same job:** Running Playwright tests in the same job as unit tests wastes time because `playwright install --with-deps` downloads ~300 MB of browser binaries. Keep them in separate jobs.
- **`actions/upload-artifact@v3` deprecation:** GitHub deprecated v3; use `@v4` which uses a different (faster) upload backend and requires Node 20+.
- **Missing `fail-fast: false` on shard matrix:** Without this, if shard 1 fails, shards 2 and 3 are cancelled and their reports are never uploaded — making it impossible to see whether the failure is isolated.
