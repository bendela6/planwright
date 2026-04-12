# Prettier Guidelines

## Overview
Prettier handles all code formatting. No manual style decisions — Prettier makes them. ESLint is configured to defer all formatting to Prettier via `eslint-config-prettier`. A shared config in `packages/config/` is re-exported from every app and package.

## Rules

### [RECOMMENDED] Standard `.prettierrc` options
- **What:** A consistent set of formatting options used across the entire monorepo.
- **Config:**
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2,
    "useTabs": false,
    "bracketSpacing": true,
    "bracketSameLine": false,
    "arrowParens": "always",
    "endOfLine": "lf",
    "plugins": [
      "prettier-plugin-tailwindcss",
      "@ianvs/prettier-plugin-sort-imports"
    ],
    "importOrder": [
      "^(react|react-dom)(.*)$",
      "<THIRD_PARTY_MODULES>",
      "^@project/(.*)$",
      "^[./]"
    ],
    "importOrderSeparation": false,
    "importOrderSortSpecifiers": true,
    "tailwindConfig": "./tailwind.config.ts"
  }
  ```
- **Why:** `trailingComma: "all"` minimizes diff noise in multi-line function calls and arrays (adding a new argument doesn't change the previous line). `printWidth: 100` is a practical balance — 80 is often too narrow for TypeScript generics.

### [RECOMMENDED] Shared config package
- **What:** Export the config from `packages/config/prettier/index.js` and reference it in each workspace's config file.
- **Config:**
  ```js
  // packages/config/prettier/index.js
  /** @type {import("prettier").Config} */
  const config = {
    semi: true,
    singleQuote: true,
    trailingComma: "all",
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    bracketSpacing: true,
    arrowParens: "always",
    endOfLine: "lf",
    plugins: ["@ianvs/prettier-plugin-sort-imports"],
    importOrder: [
      "^(react|react-dom)(.*)$",
      "<THIRD_PARTY_MODULES>",
      "^@project/(.*)$",
      "^[./]",
    ],
    importOrderSeparation: false,
    importOrderSortSpecifiers: true,
  };

  export default config;
  ```
  ```js
  // apps/web/.prettierrc.js (adds tailwind plugin)
  import baseConfig from "@project/config/prettier";

  /** @type {import("prettier").Config} */
  export default {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      "prettier-plugin-tailwindcss",
    ],
    tailwindConfig: "./tailwind.config.ts",
  };
  ```
  ```js
  // apps/api/.prettierrc.js (no tailwind)
  import baseConfig from "@project/config/prettier";
  export default baseConfig;
  ```
- **Why:** Centralizing config prevents per-app drift. The web app extends with `prettier-plugin-tailwindcss`; the API does not need it.

### [RECOMMENDED] `prettier-plugin-tailwindcss` for Tailwind class sorting
- **What:** Automatically sorts Tailwind CSS classes in JSX `className` props and `clsx`/`cn` calls according to the official class order.
- **Config:** Add to `plugins` array and point `tailwindConfig` at your `tailwind.config.ts`.
- **Why:** Consistent class ordering makes Tailwind diffs readable and avoids merge conflicts from developers sorting classes differently.

### [RECOMMENDED] `@ianvs/prettier-plugin-sort-imports` for import ordering
- **What:** Sorts import statements according to `importOrder` groups: React → third-party → internal (`@project/*`) → relative.
- **Why:** Consistent import order reduces cognitive overhead when scanning files and eliminates a class of trivial review comments.

### [RECOMMENDED] `.prettierignore`
- **What:** Exclude generated files, build output, and lockfiles from formatting.
- **Config:**
  ```
  # Build output
  dist/
  .next/
  .turbo/
  out/

  # Generated
  *.generated.ts
  *.generated.graphql

  # Lockfile (pnpm formats this itself)
  pnpm-lock.yaml

  # Env files
  .env*
  ```
- **Why:** Formatting generated files wastes time and creates noisy diffs. Prettier modifying `pnpm-lock.yaml` can corrupt it.

### [RECOMMENDED] Turbo integration
- **Config:**
  ```json
  {
    "tasks": {
      "format:check": {
        "outputs": [],
        "inputs": ["src/**/*.{ts,tsx,js,json}", ".prettierrc*", "prettier.config.*"]
      }
    }
  }
  ```
  ```json
  {
    "scripts": {
      "format:check": "prettier --check src",
      "format:write": "prettier --write src"
    }
  }
  ```
- **Why:** `format:check` runs in CI to fail on unformatted code. `format:write` is the local fix command. The root-level `format:write` runs across all packages.

## Common Pitfalls

- Configuring formatting rules in ESLint alongside Prettier: They will conflict. Use `eslint-config-prettier` to disable all ESLint formatting rules and let Prettier own formatting.
- Plugin order matters for `prettier-plugin-tailwindcss`: It must be last in the `plugins` array — it works by transforming the already-formatted output of other plugins.
- Using `.prettierrc.json` to extend the shared config: JSON configs cannot use `import`. Use `.prettierrc.js` or `prettier.config.js` with `export default`.
- `printWidth` is not a hard limit: Prettier treats it as a target, not a maximum. Long strings, template literals, and deeply nested JSX will exceed it.
