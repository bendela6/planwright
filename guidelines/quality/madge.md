# Madge Guidelines

## Overview
Madge detects circular dependencies in TypeScript/JavaScript source trees. Circular imports are a common source of subtle runtime errors (undefined imports at module initialization time) and make tree-shaking less effective. Running madge in CI catches cycles before they reach production.

## Rules

### [RECOMMENDED] Per-package `madge` script targeting `src/`
- **What:** Each package and app has a `madge` script that scans its own `src/` directory for circular dependencies.
- **Config:**
  ```json
  {
    "scripts": {
      "madge": "madge --circular --extensions ts,tsx src/"
    }
  }
  ```
- **Why:** Scoping to `src/` excludes `dist/`, `node_modules/`, and generated files. Running per-package keeps output focused and makes Turborepo caching effective.

### [RECOMMENDED] `.madgerc` with TypeScript support
- **What:** Configure madge to use the TypeScript path resolver so it follows `paths` aliases defined in `tsconfig.json`.
- **Config:**
  ```json
  {
    "fileExtensions": ["ts", "tsx"],
    "detectiveOptions": {
      "ts": {
        "mixedImports": true
      }
    },
    "tsConfig": "./tsconfig.json"
  }
  ```
- **Why:** Without `tsConfig`, madge cannot resolve `@/` path aliases and will report false positives or miss real cycles that go through aliased paths. `mixedImports: true` handles files that mix ESM `import` and CommonJS `require`.

### [RECOMMENDED] Turbo integration
- **What:** Register `madge` as a Turborepo task so it participates in incremental caching.
- **Config:**
  ```json
  {
    "tasks": {
      "madge": {
        "dependsOn": [],
        "outputs": [],
        "inputs": ["src/**/*.{ts,tsx}", "tsconfig.json", ".madgerc"]
      }
    }
  }
  ```
- **Why:** Caching madge results means it only re-runs when source files or config changes. On a large monorepo this saves significant CI time.

### [SUGGESTED] Exclude test files from circular check
- **What:** Use `--exclude` to skip test files, which often have circular relationships with the modules they test.
- **Config:**
  ```json
  {
    "scripts": {
      "madge": "madge --circular --extensions ts,tsx --exclude '.*\\.test\\.tsx?$|.*\\.spec\\.tsx?$' src/"
    }
  }
  ```
- **Why:** Test files importing the module under test alongside test utilities can create acceptable cycles that would otherwise generate false positives.

### [SUGGESTED] Generate a dependency graph image for documentation
- **What:** Use `--image` to output a PNG of the full dependency graph.
- **Config:**
  ```json
  {
    "scripts": {
      "madge:graph": "madge --image graph.png --extensions ts,tsx src/"
    }
  }
  ```
- **Why:** A visual graph is useful during architecture reviews to identify tightly coupled modules or unexpected fan-in. This script does not run in CI — it is a developer tool.

## Configuration

Full working setup for a typical package:

```
packages/utils/
  .madgerc          # tsConfig + fileExtensions
  package.json      # "madge": "madge --circular --extensions ts,tsx src/"
  tsconfig.json     # required for path alias resolution
  src/
    index.ts
```

Install dependency (root, not per-package):
```sh
pnpm add -D madge -w
```

## Common Pitfalls

- Missing `tsConfig` in `.madgerc`: madge falls back to basic regex-based import parsing that cannot resolve path aliases. Cycles through `@/` imports will not be detected.
- Running madge on `dist/` instead of `src/`: Compiled output may have different import paths. Always target `src/`.
- Not excluding `node_modules`: Madge normally ignores `node_modules` but explicit `--exclude 'node_modules'` guards against unusual symlink setups created by pnpm.
- Treating all cycles as errors blindly: Some bundler-friendly patterns (e.g. barrel `index.ts` files) create cycles that are harmless. Review each detected cycle before marking the build red — then either fix the cycle or add a targeted `--exclude` pattern.
- Installing madge per-package instead of at root: Madge is a dev tool; install once at the workspace root and rely on pnpm's workspace hoisting.
