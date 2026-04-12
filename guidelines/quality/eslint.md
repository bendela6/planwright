# ESLint Guidelines

## Overview
ESLint enforces code correctness and style rules that TypeScript alone cannot catch (unused variables, import ordering, React hooks rules). The flat config system (`eslint.config.js`) is the only supported format as of ESLint 9. A shared config in `packages/config/` ensures consistent rules across all apps and packages.

## Rules

### [RECOMMENDED] Use flat config format only (`eslint.config.js`)
- **What:** All projects use `eslint.config.js` (or `.mjs`). The legacy `.eslintrc`, `.eslintrc.json`, `.eslintrc.js` formats are not used.
- **Config:**
  ```js
  // packages/config/eslint/index.js
  import tseslint from "typescript-eslint";
  import reactPlugin from "eslint-plugin-react";
  import reactHooksPlugin from "eslint-plugin-react-hooks";
  import prettierConfig from "eslint-config-prettier";

  export const base = tseslint.config(
    {
      extends: [
        ...tseslint.configs.strictTypeChecked,
        ...tseslint.configs.stylisticTypeChecked,
      ],
      rules: {
        "@typescript-eslint/no-explicit-any": "error",
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
        ],
        "@typescript-eslint/consistent-type-imports": [
          "error",
          { prefer: "type-imports", fixStyle: "inline-type-imports" },
        ],
        "@typescript-eslint/no-import-type-side-effects": "error",
      },
    },
    prettierConfig,
  );

  export const react = tseslint.config(
    ...base,
    {
      plugins: {
        react: reactPlugin,
        "react-hooks": reactHooksPlugin,
      },
      rules: {
        ...reactPlugin.configs.recommended.rules,
        ...reactHooksPlugin.configs.recommended.rules,
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
      settings: {
        react: { version: "detect" },
      },
    },
  );
  ```
  ```js
  // apps/web/eslint.config.js
  import { react } from "@project/config/eslint";
  import tseslint from "typescript-eslint";

  export default tseslint.config(
    ...react,
    {
      languageOptions: {
        parserOptions: {
          project: true,
          tsconfigRootDir: import.meta.dirname,
        },
      },
    },
    {
      ignores: ["dist/**", "node_modules/**"],
    },
  );
  ```
- **Why:** Flat config is composable via plain JS arrays, eliminates the "extends resolution" ambiguity of legacy config, and is the only format supported in ESLint 9+.

### [RECOMMENDED] `@typescript-eslint/no-explicit-any: "error"`
- **What:** Prohibits explicit `any` annotations. Code must use `unknown`, generics, or specific types.
- **Why:** Paired with TypeScript's `noImplicitAny`, this closes the remaining gap — a developer could still write `const x: any = ...` without this rule.

### [RECOMMENDED] `@typescript-eslint/no-unused-vars: "error"` with underscore prefix exception
- **What:** Unused variables are errors. Variables prefixed with `_` are intentionally unused and exempt.
- **Config:** See `argsIgnorePattern: "^_"` above.
- **Why:** Unused variables are almost always a bug or leftover from refactoring. The underscore convention is the universally accepted signal for "intentionally unused."

### [RECOMMENDED] `@typescript-eslint/consistent-type-imports`
- **What:** Forces `import type { Foo }` for type-only imports. Use `inline-type-imports` so the fix is per-specifier, not per-statement.
- **Why:** Aligns with `verbatimModuleSyntax` in tsconfig. Bundlers can eliminate type imports during tree-shaking only when they are clearly marked.

### [RECOMMENDED] `eslint-config-prettier` as last config
- **What:** Disables all ESLint formatting rules that conflict with Prettier. Must be spread last in the config array.
- **Why:** ESLint formatting rules and Prettier will fight each other without this. `eslint-config-prettier` turns off ESLint's formatting opinions so Prettier owns formatting.

### [SUGGESTED] Enable `strictTypeChecked` for typed linting
- **What:** Use `tseslint.configs.strictTypeChecked` instead of just `recommended`. Requires `parserOptions.project` to be set.
- **Why:** Typed rules catch real bugs: `@typescript-eslint/no-floating-promises`, `@typescript-eslint/await-thenable`, `@typescript-eslint/no-misused-promises`. These require type information and cannot run without `project` pointing to a valid tsconfig.

## Configuration

```jsonc
// turbo.json task for lint
{
  "tasks": {
    "lint": {
      "dependsOn": [],
      "outputs": [],
      "inputs": ["src/**/*.{ts,tsx}", "eslint.config.js", "tsconfig.json"]
    }
  }
}
```

Package-level `package.json` script:
```json
{
  "scripts": {
    "lint": "eslint src --max-warnings 0"
  }
}
```

Install dependencies:
```sh
pnpm add -D eslint typescript-eslint eslint-plugin-react eslint-plugin-react-hooks eslint-config-prettier -w
```

## Common Pitfalls

- Using `.eslintrc` or `eslintrc.json`: ESLint 9 ignores these by default. If you see no lint errors and no output, check if you accidentally created a legacy config file.
- Forgetting `parserOptions.project` for typed rules: Rules from `strictTypeChecked` silently no-op without a project reference. Always set `project: true` and `tsconfigRootDir: import.meta.dirname`.
- Placing `prettierConfig` before other configs: It must be last — it disables formatting rules, and any config added after it can re-enable them.
- Using `tseslint.configs.recommended` instead of `strictTypeChecked`: `recommended` skips the typed rules entirely. Always use `strictTypeChecked` for full coverage.
- Missing `"react/react-in-jsx-scope": "off"`: React 17+ with the new JSX transform does not require React in scope. Without this override, every JSX file errors.
