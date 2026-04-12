---
name: planwright
description: Use when planning a new software project or auditing an existing project against standards. An AI-powered project planner that generates architecture designs, suggests tech stacks, and verifies compliance with your guidelines. Invoke with argument 'new' or 'audit'.
---

# Planwright

An AI project planner with two modes:
- `/planwright new` — design a new project and generate an architecture blueprint
- `/planwright audit` — check an existing project against your standards and plan fixes interactively

## Argument Parsing

Parse the argument passed to this skill:
- If argument is `new` → proceed to **New Project Mode**
- If argument is `audit` → proceed to **Audit Mode**
- If no argument → ask the user: "Would you like to create a **new** project or **audit** an existing one?"

## Guideline Loading

Guidelines are organized in sub-folders under `guidelines/`. Load them selectively based on project needs. All guidelines are **recommendations** — the user can opt out of anything.

### Dependency Map

**Core group** (loaded by default for new projects, user can opt out of individual items):
- `guidelines/core/base.md` — always loaded first
- `guidelines/core/typescript.md`
- `guidelines/quality/eslint.md`
- `guidelines/quality/prettier.md`
- `guidelines/quality/madge.md`
- `guidelines/quality/knip.md`
- `guidelines/quality/syncpack.md`
- `guidelines/quality/husky.md`

**React group** (when frontend uses React):
- `guidelines/frontend/react.md`
- `guidelines/frontend/tailwind.md`
- `guidelines/frontend/tanstack-router.md`
- `guidelines/frontend/tanstack-query.md`
- `guidelines/frontend/shadcn.md`
- `guidelines/shared/valibot.md`
- `guidelines/testing/vitest.md`
- `guidelines/testing/playwright.md`

**Fastify group** (when API uses Fastify):
- `guidelines/backend/fastify.md`
- `guidelines/backend/drizzle.md`
- `guidelines/backend/pino.md`
- `guidelines/shared/valibot.md`
- `guidelines/testing/vitest.md`

**NestJS group** (audit-only, for existing NestJS apps):
- `guidelines/backend/nestjs.md`
- `guidelines/backend/pino.md`
- `guidelines/testing/vitest.md`

**Infrastructure group** (optional, asked or auto-detected):
- `guidelines/infrastructure/docker.md`
- `guidelines/infrastructure/github-actions.md`

**Deployment group** (optional, asked or auto-detected):
- `guidelines/deployment/cloud-run.md`
- `guidelines/deployment/cloud-build.md`
- `guidelines/deployment/vercel.md`

**Notification group** (optional, asked or auto-detected):
- `guidelines/notifications/slack.md`
- `guidelines/notifications/discord.md`
- `guidelines/notifications/webhook.md`

When loading, deduplicate files that appear in multiple groups (e.g., `valibot.md` appears in both React and Fastify groups — load it once).

### Audit Auto-Detection Signals

When in audit mode, detect project type by scanning these signals:

| Signal | Loads |
|--------|-------|
| `react` or `react-dom` in package.json dependencies | React group |
| `fastify` in package.json dependencies | Fastify group |
| `@nestjs/core` in package.json dependencies | NestJS group |
| `Dockerfile` exists in repo | `infrastructure/docker.md` |
| `.github/workflows/` directory exists | `infrastructure/github-actions.md` |
| `cloudbuild.yaml` exists in repo | `deployment/cloud-build.md` |
| `vercel.json` or `.vercel/` exists | `deployment/vercel.md` |
| Cloud Run config or `gcloud` references found | `deployment/cloud-run.md` |
| Slack webhook URL in env files or config | `notifications/slack.md` |
| Discord webhook URL in env files or config | `notifications/discord.md` |
| Generic webhook config found | `notifications/webhook.md` |

After detection, confirm with the user: "I detected: [list]. Correct? Anything to add or remove?"

## New Project Mode

Read and follow the workflow defined in:
`workflows/new-project.md`

## Audit Mode

Read and follow the workflow defined in:
`workflows/audit-project.md`
