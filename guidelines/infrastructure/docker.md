# Docker Guidelines

## Overview
Docker is used to produce reproducible, minimal production images for all backend apps and to run dependent services (PostgreSQL) locally and in CI. Multi-stage builds for pnpm monorepos require careful layer ordering to exploit the Docker build cache: `pnpm fetch` downloads dependencies from the lockfile alone, then `pnpm install --offline` materialises them without a network hit on subsequent builds.

## Rules

### [REQUIRED] Multi-stage Dockerfile with pnpm fetch pattern
- **What:** Use four named stages: `base`, `deps`, `builder`, and `runner`.
- **Why:** Separating dependency installation from source compilation means changing a source file does not invalidate the expensive `pnpm fetch` layer. The final `runner` stage contains only the production artifact.

### [REQUIRED] `packageManager` field in root `package.json`
- **What:** Declare the exact pnpm version so `corepack enable` picks up the right binary.
- **Config:**
  ```json
  // package.json (repo root)
  {
    "packageManager": "pnpm@9.15.4"
  }
  ```
- **Why:** Without this field, `corepack` installs an arbitrary pnpm version. The version must match `.npmrc` / CI to avoid lockfile integrity errors.

### [REQUIRED] Non-root user in production image
- **What:** Switch to the `node` user (pre-created in the official Node Alpine image) before the `CMD` instruction.
- **Why:** Running as root inside a container is a security risk — if the process is exploited, the attacker gets root access to the container filesystem.

### [REQUIRED] Health check in Dockerfile
- **What:** Add a `HEALTHCHECK` so container orchestrators (Cloud Run, ECS, Kubernetes) know when the app is ready.
- **Config:**
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1
  ```
- **Why:** Without a health check, a container that crashes on startup may still receive traffic.

### [REQUIRED] `.dockerignore` file
- **What:** Exclude build artefacts and secrets from the Docker build context.
- **Config:**
  ```
  # .dockerignore
  .git
  .github
  node_modules
  **/node_modules
  **/dist
  **/.turbo
  .env
  .env.*
  !.env.example
  playwright-report
  coverage
  ```
- **Why:** A missing `.dockerignore` copies `node_modules` into the build context, inflating context size and potentially overwriting the container's installed modules.

### [RECOMMENDED] Docker Compose for local dev
- **What:** Provide a `docker-compose.yml` at the repo root for spinning up the app and its dependencies together.
- **Why:** Eliminates "works on my machine" for database-dependent local development.

## Configuration

### Complete multi-stage Dockerfile

```dockerfile
# syntax=docker/dockerfile:1

# ── Stage 1: base ────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable

# ── Stage 2: deps ─────────────────────────────────────────────────────────────
# Fetch all dependencies using only the lockfile.
# This layer is cached as long as pnpm-lock.yaml does not change.
FROM base AS deps
WORKDIR /app

# Copy manifests required for pnpm fetch
COPY pnpm-lock.yaml ./
COPY package.json ./

# Copy all package.json files to satisfy workspace resolution
COPY packages/*/package.json ./packages/
COPY apps/api/package.json ./apps/api/

RUN pnpm fetch --prod

# ── Stage 3: builder ──────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

# Restore the fetched store from the deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store

# Copy full source
COPY . .

# Install from the offline store (no network)
RUN pnpm install --offline --frozen-lockfile

# Build only the app we care about (Turbo prune first for smaller context)
RUN pnpm turbo run build --filter=api

# ── Stage 4: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN corepack enable
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts and production node_modules only
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

# Non-root user (pre-exists in node:alpine)
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
```

### Turbo prune variant (recommended for large monorepos)

Use `turbo prune` before `COPY . .` to strip unrelated packages from the build context:

```dockerfile
# In CI / build script, before docker build:
# pnpm dlx turbo prune api --docker
# docker build -f apps/api/Dockerfile ./out

FROM base AS deps
WORKDIR /app
COPY out/json/ .
COPY out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm fetch --prod

FROM base AS builder
WORKDIR /app
COPY --from=deps /root/.local/share/pnpm/store /root/.local/share/pnpm/store
COPY out/full/ .
RUN pnpm install --offline --frozen-lockfile
RUN pnpm turbo run build --filter=api
```

### `docker-compose.yml` for local development

```yaml
# docker-compose.yml
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: runner
    ports:
      - '3000:3000'
    environment:
      DATABASE_URL: postgresql://postgres:postgres@db:5432/app
      NODE_ENV: development
    depends_on:
      db:
        condition: service_healthy
    develop:
      watch:
        - action: rebuild
          path: apps/api/src

  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: app
    ports:
      - '5432:5432'
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pg_data:
```

### `docker-compose.test.yml` for integration tests

```yaml
# docker-compose.test.yml
version: '3.9'

services:
  db:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: test
    ports:
      - '5432:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 3s
      retries: 10
    tmpfs:
      - /var/lib/postgresql/data  # ephemeral — fast, no disk I/O
```

## Common Pitfalls

- **Copying `node_modules` from host:** If `.dockerignore` does not exclude `node_modules`, the host modules are copied over the container's installed ones. This causes subtle binary incompatibilities on Linux images when built on macOS.
- **pnpm store not preserved between stages:** The offline store lives at `/root/.local/share/pnpm/store`. Copy it explicitly with `COPY --from=deps` or `pnpm install` will re-download packages in the builder stage.
- **Wrong `target` in Compose:** Running `docker compose up` without specifying `target: runner` will build all stages and stop at the last, potentially leaving dev tools in the image.
- **Health check on `/` vs `/health`:** Some frameworks serve a 302 redirect on `/` when unauthenticated. Use a dedicated `/health` endpoint that always returns 200 with a simple JSON body.
- **Running as root:** Omitting `USER node` means the process runs as UID 0. This is a container escape risk and fails some registry security scans.
