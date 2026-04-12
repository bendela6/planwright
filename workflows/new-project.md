# New Project Workflow

This workflow guides the creation of a new project following recommended guidelines.

## Step 1: Gather Requirements

Ask the user to describe what they're building in their own words. One open-ended question:

> "Describe what you're building — what does it do, who is it for, and what are the key features?"

Based on their description, suggest:

1. **Project name** — a short, kebab-case name derived from the description
2. **Project type** — what apps and frameworks to use:
   - Frontend only → React (Vite, Tailwind v4, TanStack Router, TanStack Query, Shadcn)
   - API only → Fastify (Drizzle + PostgreSQL, Pino)
   - Fullstack → React frontend + Fastify API + api-contract package
3. **Optional infrastructure:**
   - Docker (containerization)
   - GitHub Actions (CI)
   - Deployment target (Cloud Run for API, Vercel for frontend)
   - Notifications (Slack, Discord, webhook)

Present all suggestions and let the user approve, adjust, or remove anything:

> "Here's what I'd recommend:
> - **Name:** `[suggested-name]`
> - **Type:** [Fullstack / Frontend / API]
> - **Frontend:** React + Vite + Tailwind v4 + TanStack Router + TanStack Query + Shadcn
> - **API:** Fastify + Drizzle + PostgreSQL + Pino
> - **Shared:** api-contract (Valibot schemas)
> - **Quality tools:** TypeScript, ESLint, Prettier, Madge, Knip, Syncpack, Husky
> - **Infrastructure:** Docker, GitHub Actions CI
> - **Deployment:** Cloud Run (API) + Vercel (frontend)
> - **Notifications:** [none by default — ask if they want any]
>
> Want to change anything? You can remove items, swap frameworks, or add more."

## Step 2: Load Guidelines

Based on confirmed selections, load the relevant guideline files from the dependency map in SKILL.md. Read each loaded guideline file to understand the specific rules and configurations.

## Step 3: Generate Architecture Design

Generate a full architecture design document based on the loaded guidelines and the user's requirements. The document covers:

1. **Project overview** — name, purpose, high-level description
2. **System architecture diagram** — how apps and packages relate, data flow (Mermaid diagram)
3. **Monorepo layout** — full tree with descriptions per package/app
4. **Package dependency graph** — which packages import which (Mermaid diagram)
5. **API design** — endpoint groups, authentication flow, key routes (if backend)
6. **Data model** — core entities and relationships (if backend)
7. **Frontend architecture** — page structure, routing map, state management approach (if frontend)
8. **Infrastructure** — Docker setup, CI pipeline, deployment targets
9. **Key dependencies** — per package, with versions
10. **Turbo pipeline** — task configuration and dependency order

### Presentation options

Ask the user how they'd like to review the architecture:

> "I've generated the architecture design. How would you like to review it?
> - **Browser (recommended)** — interactive HTML with Mermaid diagrams and inline annotation. You can add notes to any section and send them back to me for revision.
> - **Markdown** — written to a file you can review in your editor."

#### Browser mode

If the user selects browser:

1. Write the architecture document as markdown to `{PROJECT_DIR}/.project-guide/architecture.md`
2. Start the reviewer app:
```bash
cd ~/.claude/skills/project-guide/reviewer-app
PLAN_FILE={PROJECT_DIR}/.project-guide/architecture.md \
PROJECT_DIR={PROJECT_DIR} \
pnpm run start &
```
3. Tell the user: "Architecture review is ready at http://localhost:3333. You can:
   - Review the architecture in the **Plan** tab
   - Add notes to any section by clicking or selecting text
   - Click **Send to agent** when you have feedback
   - Click **Approve** when the architecture looks good
   - Check implementation progress in the **Status** tab"
4. Watch for `{PROJECT_DIR}/.project-guide/review-notes.json`:
   - If `status` is `"review"`: read the notes, apply changes to the architecture markdown, tell user to refresh the page
   - If `status` is `"approved"`: stop the app, save final `docs/architecture.md`, proceed to Step 4
   - Delete the review file after reading so the next round starts clean
5. Clean up on approval:
```bash
kill %1 %2  # stop the reviewer app
rm -rf {PROJECT_DIR}/.project-guide/
```

#### Markdown mode

If the user selects markdown:
1. Write the architecture document to `docs/architecture.md`
2. Tell the user to review it
3. Ask if they want to make changes — iterate until approved

## Step 4: Hand Off to writing-plans

Once the architecture is approved:

1. Save the final architecture to `docs/architecture.md` (if not already saved)
2. Invoke the `writing-plans` skill with the architecture document as context
3. The implementation plan will cover scaffolding every approved component

> "Architecture approved and saved to `docs/architecture.md`. Now invoking `writing-plans` to create the implementation plan."

Invoke the `writing-plans` skill.
