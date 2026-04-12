# planwright

An AI project planner that designs new software projects and audits existing ones against your standards.

Planwright is a Claude Code skill (with a TypeScript web UI) that:

- **Plans new projects** — you describe what you're building, it suggests a tech stack, generates an architecture blueprint, and hands off to an implementation plan
- **Audits existing projects** — it scans a project, reports what matches your standards, and walks you through fixes interactively

Standards are defined as modular guideline files — one per tool or technology — organized by category. You opt in to the ones that apply to your project.

## Install

```bash
git clone https://github.com/bendela6/planwright.git
cd planwright
./install.sh
```

This symlinks `~/.claude/skills/planwright/` to the repo (dev install — `git pull` updates are immediately active) and installs the reviewer app's dependencies.

Alternative:

```bash
./install.sh --copy        # Copy files instead of symlinking
./install.sh --uninstall   # Remove the installed skill
```

## Usage

After installing, invoke from Claude Code:

```
/planwright new     # Design a new project
/planwright audit   # Check an existing project
```

## What's inside

```
planwright/
├── SKILL.md                 # Skill entry point (router + dependency map)
├── workflows/
│   ├── new-project.md       # New project workflow
│   └── audit-project.md     # Audit workflow
├── guidelines/              # Modular guideline files, one per tool
│   ├── core/                # Base monorepo + TypeScript
│   ├── quality/             # ESLint, Prettier, Madge, Knip, Syncpack, Husky
│   ├── testing/             # Vitest, Playwright
│   ├── infrastructure/      # Docker, GitHub Actions
│   ├── deployment/          # Cloud Run, Cloud Build, Vercel
│   ├── notifications/       # Slack, Discord, webhook
│   ├── frontend/            # React, Tailwind v4, TanStack, Shadcn
│   ├── backend/             # Fastify, NestJS, Drizzle, Pino
│   └── shared/              # Valibot
└── reviewer-app/            # Web UI for plan review + implementation status
```

## Reviewer app

The reviewer app is a small Vite + React + TypeScript + Tailwind v4 + Fastify application at `reviewer-app/`. Planwright starts it during interactive review sessions to let you:

- View plans and architecture docs with Mermaid diagrams and a navigable TOC
- Add inline notes to any section or text fragment
- Send notes back to the agent for revision
- Track implementation progress in real time

Start it standalone:

```bash
cd reviewer-app
PLAN_FILE=/path/to/plan.md PROJECT_DIR=$(pwd) pnpm run start
```

Free ports are picked automatically and printed at startup.
