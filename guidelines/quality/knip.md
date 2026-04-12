# Knip Guidelines

## Overview
Knip finds unused exports, files, and dependencies across the entire monorepo. It is the complement to TypeScript's type checking — TypeScript verifies correctness of used code; Knip surfaces code that is never used at all. Running knip prevents dead code accumulation and keeps `package.json` dependencies lean.

## Rules

### [RECOMMENDED] `knip.json` at repo root with workspace config
- **What:** Single root `knip.json` defines the workspace layout and per-package entry point configuration. The root workspace is always `"."`.
- **Config:**
  ```json
  {
    "$schema": "https://unpkg.com/knip@latest/schema.json",
    "workspaces": {
      ".": {
        "entry": ["turbo.json", "pnpm-workspace.yaml"],
        "project": ["*.{ts,js,json}"]
      },
      "apps/web": {
        "entry": ["src/main.tsx", "src/routes/**/*.tsx", "vite.config.ts"],
        "project": ["src/**/*.{ts,tsx}"]
      },
      "apps/api": {
        "entry": ["src/main.ts", "src/app.ts"],
        "project": ["src/**/*.{ts}"]
      },
      "packages/ui": {
        "entry": ["src/index.ts"],
        "project": ["src/**/*.{ts,tsx}"]
      },
      "packages/utils": {
        "entry": ["src/index.ts"],
        "project": ["src/**/*.{ts}"]
      },
      "packages/types": {
        "entry": ["src/index.ts"],
        "project": ["src/**/*.{ts}"]
      },
      "packages/api-contract": {
        "entry": ["src/index.ts"],
        "project": ["src/**/*.{ts}"]
      },
      "packages/config": {
        "entry": ["tsconfig/**/*.json", "eslint/index.js", "prettier/index.js"],
        "project": ["**/*.{ts,js,json}"]
      }
    },
    "ignore": [
      "**/*.generated.ts",
      "**/dist/**",
      "**/.next/**",
      "**/__mocks__/**"
    ],
    "ignoreBinaries": ["turbo", "concurrently"],
    "ignoreExportsUsedInFile": true
  }
  ```
- **Why:** Declaring `entry` per workspace tells knip where the public surface begins. Without accurate entry points, knip cannot distinguish "exported but never consumed externally" from "genuinely dead code." The `"."` root workspace entry prevents knip from flagging config files as unused.

### [RECOMMENDED] `ignoreExportsUsedInFile: true`
- **What:** Do not flag an export as unused if it is consumed within the same file.
- **Why:** Barrel files (`index.ts`) re-export everything and are the canonical entry point — their re-exports are used externally even if not consumed within the file. This flag prevents false positives in that pattern.

### [RECOMMENDED] `ignore` for generated files
- **What:** Exclude codegen output (GraphQL generated types, Prisma client, OpenAPI types) from knip analysis.
- **Config:** Add patterns to the top-level `ignore` array.
- **Why:** Generated files are not authored code. Knip should not report them as having unused exports — they're consumed via the generator's own output conventions.

### [RECOMMENDED] Turbo integration
- **What:** Register `knip` as a Turborepo task at the root level (it runs once across the whole repo, not per-package).
- **Config:**
  ```json
  {
    "tasks": {
      "knip": {
        "dependsOn": ["^build"],
        "outputs": [],
        "inputs": [
          "knip.json",
          "apps/*/src/**/*.{ts,tsx}",
          "packages/*/src/**/*.{ts,tsx}"
        ]
      }
    }
  }
  ```
  ```json
  {
    "scripts": {
      "knip": "knip"
    }
  }
  ```
- **Why:** `dependsOn: ["^build"]` ensures all packages are built before knip analyses cross-package imports. Knip needs the full dependency graph to be accurate.

### [SUGGESTED] Production mode in CI
- **What:** Run `knip --production` in CI to report only unused code that affects the production bundle (excludes test files, dev scripts).
- **Config:**
  ```json
  {
    "scripts": {
      "knip:production": "knip --production"
    }
  }
  ```
- **Why:** `--production` mode is stricter and removes noise from test utilities and dev-only helpers. Use regular `knip` locally for a full picture.

## Configuration

Install:
```sh
pnpm add -D knip typescript -w
```

Verify with:
```sh
pnpm knip --reporter compact
```

## Common Pitfalls

- Not declaring entry points per workspace: If `entry` is omitted, knip uses its default heuristics (e.g. `src/index.ts`). This works for simple libraries but will miss custom entry points like Vite's `src/main.tsx` or route-based entries.
- Missing `"^build"` in `dependsOn`: If a dependency package hasn't been built, knip cannot follow its import graph. You'll see false "unused" reports for packages that are genuinely used.
- Listing `"."` workspace entries as just `[]`: The root workspace needs at least `turbo.json` and config files listed or knip reports them all as unused.
- Confusing `ignore` (file paths) with `ignoreDependencies` (package names): Use `ignore` for file globs. Use `ignoreDependencies` for packages like `["@types/*", "eslint-*"]` that are used implicitly.
- Running knip without `--production` in CI gives noisy results: Dev dependencies and test utilities show up as "used" even if they'd be unused in production. Pick one mode and stick to it in CI.
