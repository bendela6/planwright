# TypeScript Guidelines

## Overview
TypeScript is the mandatory language for all packages and apps. Strict mode is always on. A shared base `tsconfig.json` in `packages/config/` ensures consistent compiler behavior across the monorepo.

## Rules

### [RECOMMENDED] Enable `strict: true` (all sub-flags)
- **What:** `strict` enables: `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitAny`, `noImplicitThis`, `alwaysStrict`, and `useUnknownInCatchVariables`.
- **Config:**
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true
    }
  }
  ```
- **Why:** `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not included in `strict` but catch common runtime errors. Enable all of them from project start — retrofitting is expensive.

### [RECOMMENDED] No `any` — use `unknown`, generics, or specific interfaces
- **What:** `any` disables type checking for the variable and all downstream uses. Prefer `unknown` (requires a type guard), a generic `<T>`, or a concrete interface.
- **Config:** Enforce via ESLint rule `@typescript-eslint/no-explicit-any: "error"`. For JSON parsing:
  ```ts
  // Bad
  const data: any = JSON.parse(text);

  // Good
  const data: unknown = JSON.parse(text);
  if (isMyType(data)) { /* use data */ }

  // Also good
  const data = JSON.parse(text) as MyType; // only when you control the source
  ```
- **Why:** `any` is a type-system escape hatch that silently removes safety guarantees across call chains. `unknown` forces narrowing at the point of use.

### [RECOMMENDED] Shared base tsconfig in `packages/config/`
- **What:** All packages extend a base config. Each package overrides only what differs (`outDir`, `paths`, `lib`).
- **Config:**
  ```json
  // packages/config/tsconfig/base.json
  {
    "$schema": "https://json.schemastore.org/tsconfig",
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022"],
      "module": "ESNext",
      "moduleResolution": "bundler",
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "exactOptionalPropertyTypes": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "isolatedModules": true,
      "verbatimModuleSyntax": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    }
  }
  ```
  ```json
  // apps/web/tsconfig.json (Vite app)
  {
    "extends": "@project/config/tsconfig/base.json",
    "compilerOptions": {
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "jsx": "react-jsx",
      "outDir": "dist",
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["src"]
  }
  ```
  ```json
  // apps/api/tsconfig.json (Node.js app)
  {
    "extends": "@project/config/tsconfig/base.json",
    "compilerOptions": {
      "lib": ["ES2022"],
      "outDir": "dist",
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": ["src"]
  }
  ```
- **Why:** A single base prevents drift. When you upgrade TypeScript or tighten a flag, one change propagates everywhere.

### [RECOMMENDED] `moduleResolution: "bundler"` for Vite apps
- **What:** Use `"bundler"` for apps built with Vite/esbuild; use `"NodeNext"` for pure Node.js packages that emit CJS/ESM.
- **Why:** `"bundler"` matches what Vite actually does: it allows extensionless imports and `index.ts` resolution without requiring `.js` extensions in import paths. Using `"Node16"` or `"NodeNext"` in a Vite app will cause false-positive errors on valid import paths.

### [RECOMMENDED] `isolatedModules: true` everywhere
- **What:** Forces every file to be a valid independent module (i.e. no const-only re-exports, no ambient module augmentation without imports).
- **Why:** esbuild and SWC transpile files in isolation without full type analysis. `isolatedModules` makes TypeScript flag patterns that would silently fail in those transpilers at tsc time.

### [RECOMMENDED] `verbatimModuleSyntax: true`
- **What:** Requires `import type` for type-only imports. Replaces the older `importsNotUsedAsValues` and `preserveValueImports` flags.
- **Config:**
  ```ts
  // Required
  import type { MyType } from "./types";
  import { myFunction } from "./utils";
  ```
- **Why:** Makes tree-shaking reliable — bundlers can drop type-only imports without needing to analyse the export to determine if it's a value.

### [SUGGESTED] Project references for large monorepos
- **What:** Add `"composite": true` and `references` arrays to enable incremental builds across packages.
- **Config:**
  ```json
  // packages/utils/tsconfig.json
  {
    "extends": "@project/config/tsconfig/base.json",
    "compilerOptions": {
      "composite": true,
      "outDir": "dist"
    },
    "include": ["src"]
  }
  ```
- **Why:** TypeScript project references allow `tsc --build` to skip re-checking packages whose inputs haven't changed. Turborepo's caching can replace much of this, but project references still give IDE performance benefits in large repos.

## Configuration

Complete `packages/config/` package layout:

```
packages/config/
  package.json        # name: "@project/config"
  tsconfig/
    base.json         # shared base (above)
    react.json        # extends base, adds jsx + DOM lib
    node.json         # extends base, adds @types/node
  eslint/
    index.js          # shared ESLint flat config
  prettier/
    index.js          # shared Prettier config
```

## Common Pitfalls

- Using `"moduleResolution": "node"` (classic): Does not support `exports` field in `package.json`. Will fail to resolve subpath exports from modern packages.
- Setting `"skipLibCheck": false` in CI: Causes spurious errors from third-party `@types` packages. Keep it `true`; you don't own those types.
- Omitting `"declarationMap": true` in library packages: Without declaration maps, Go-to-definition in the IDE jumps to the compiled `.d.ts` file, not the source `.ts` file.
- Mixing `import type` and value imports on the same line without `verbatimModuleSyntax`: Can result in the type import being emitted in output, causing runtime errors in some bundler configurations.
- Using `paths` without configuring the same aliases in Vite/bundler: `paths` only affects the TypeScript compiler. Vite needs the same aliases in `vite.config.ts` via `resolve.alias`.
