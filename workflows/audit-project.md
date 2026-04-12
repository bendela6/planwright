# Audit Project Workflow

This workflow checks an existing project against recommended guidelines and helps fix issues interactively.

## Step 1: Auto-Detect Project Type

Scan the current project to detect its type and configuration:

1. **Check for monorepo signals:**
   - Look for `pnpm-workspace.yaml`, `turbo.json`, `lerna.json`, `nx.json`
   - Check `package.json` for `workspaces` field
   - If none found, note as single-package project

2. **Check package manager:**
   - Look for `pnpm-lock.yaml` → pnpm
   - Look for `package-lock.json` → npm
   - Look for `yarn.lock` → yarn

3. **Check frameworks (scan all package.json files in the repo):**
   - `react` or `react-dom` in dependencies → React
   - `fastify` in dependencies → Fastify
   - `@nestjs/core` in dependencies → NestJS
   - `next` in dependencies → Next.js (note: not in standard guidelines, flag as detected)

4. **Check infrastructure:**
   - `Dockerfile` exists → Docker
   - `.github/workflows/` exists → GitHub Actions
   - `cloudbuild.yaml` exists → Cloud Build
   - `vercel.json` or `.vercel/` exists → Vercel

5. **Check notifications:**
   - Scan `.env*` files and config for Slack webhook URLs → Slack
   - Scan for Discord webhook URLs → Discord
   - Scan for generic webhook configs → Webhook

6. **Confirm with user:**

> "I detected the following:
> - **Structure:** [monorepo/single-package] with [package manager]
> - **Frontend:** [React / none / other]
> - **Backend:** [Fastify / NestJS / none / other]
> - **Infrastructure:** [Docker, GitHub Actions / none]
> - **Deployment:** [Cloud Run, Vercel / none]
> - **Notifications:** [Slack / none]
>
> Is this correct? Anything to add or remove?"

## Step 2: Load Guidelines

Based on confirmed detection, load the relevant guideline files from the dependency map in SKILL.md. Read each loaded guideline file to understand the specific rules and configurations.

## Step 3: Full Compliance Report

Check every rule from the loaded guidelines against the actual project. Scan the project files, configs, and structure to determine compliance.

Group the report by category. Use these tags:
- `[OK]` — matches the guideline
- `[MISSING]` — guideline recommends it, project doesn't have it
- `[DIFFERENT]` — project has it but configured differently than recommended

Format the report as:

```
## Category Name
  [TAG]  Item description (brief explanation)
```

Example:

```
## Monorepo Structure
  [OK]       Turborepo configured with turbo.json
  [DIFFERENT] Using npm instead of pnpm (recommended: pnpm)
  [MISSING]  packages/env — no typed env validation package

## Code Quality
  [OK]       TypeScript configured with strict mode
  [OK]       ESLint configured
  [DIFFERENT] ESLint using legacy .eslintrc (recommended: flat config)
  [MISSING]  Madge — no circular dependency checking
  [MISSING]  Knip — no dead code detection
  [OK]       Prettier configured
  [MISSING]  Syncpack — no dependency version sync
  [MISSING]  Husky — no pre-commit hooks

## Testing
  [OK]       Vitest configured
  [MISSING]  Playwright — no E2E tests
  [DIFFERENT] Tests mock the database (recommended: real PostgreSQL via Docker)

## Infrastructure
  [OK]       Docker configured
  [MISSING]  No health check in Dockerfile
  [DIFFERENT] Single-stage build (recommended: multi-stage)

## Deployment
  [OK]       Cloud Build configured
  [DIFFERENT] Manual deploy process (recommended: automatic on push to main)
```

Present the full report and ask:

> "Full report above. Would you like to walk through the issues and decide which to fix?"

## Step 4: Interactive Fix

If the user wants to proceed, walk through each `[MISSING]` and `[DIFFERENT]` item one at a time:

For each item:
1. **Explain** what's missing or different and what the guideline recommends
2. **Show** what the fix would look like (specific config changes, files to create, etc.)
3. **Ask:** "Want to fix this? (`yes` / `skip` / `stop`)"
   - `yes` → add to fix list
   - `skip` → move to next item
   - `stop` → end the interactive walk-through, proceed with fixes collected so far

After the walk-through (or `stop`), summarize the accepted fixes:

> "You've selected N fixes:
> 1. [fix description]
> 2. [fix description]
> ...
>
> Ready to create an implementation plan for these fixes?"

## Step 5: Hand Off to writing-plans

Once the user confirms:

1. Compile the list of accepted fixes with their details
2. Invoke the `writing-plans` skill with the fix list as context
3. The implementation plan will cover applying each fix

> "Invoking `writing-plans` to create the remediation plan for the selected fixes."

Invoke the `writing-plans` skill.
