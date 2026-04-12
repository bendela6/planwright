# Husky + lint-staged Guidelines

## Overview
Husky manages Git hooks. lint-staged runs linters and formatters against only the files staged for commit, making pre-commit checks fast regardless of repo size. Together they enforce code quality at the point of authorship — before code reaches CI.

## Rules

### [RECOMMENDED] Husky v9 setup with `husky init`
- **What:** Initialize husky using the built-in init command, which creates the `.husky/` directory and adds a `prepare` script to the root `package.json`.
- **Config:**
  ```sh
  # Run once at repo setup
  pnpm dlx husky init
  ```
  This creates:
  - `.husky/pre-commit` — hook shell script
  - Adds `"prepare": "husky"` to root `package.json`

  The `prepare` script runs automatically after every `pnpm install`, ensuring hooks are installed for all contributors.
- **Why:** Husky v9 no longer uses a `.huskyrc` or JSON config. Hooks are plain shell scripts in `.husky/`. The `prepare` lifecycle hook means new developers get hooks automatically after cloning and running `pnpm install`.

### [RECOMMENDED] `.husky/pre-commit` hook runs lint-staged
- **What:** The pre-commit hook runs lint-staged, which in turn runs per-file-type commands on staged files only.
- **Config:**
  ```sh
  # .husky/pre-commit
  pnpm lint-staged
  ```
  That's the entire file. No shebangs required in Husky v9 — hooks are executed as shell scripts automatically.
- **Why:** Delegating all logic to lint-staged keeps the hook itself trivial. lint-staged handles file filtering, parallelism, and restoring unstaged changes after running.

### [RECOMMENDED] lint-staged configuration
- **What:** Configure lint-staged in root `package.json` under the `"lint-staged"` key (or in `lint-staged.config.js`). Target staged files by extension.
- **Config:**
  ```json
  {
    "lint-staged": {
      "*.{ts,tsx}": [
        "eslint --max-warnings 0 --fix",
        "prettier --write"
      ],
      "*.{js,mjs,cjs}": [
        "eslint --max-warnings 0 --fix",
        "prettier --write"
      ],
      "*.{json,yaml,yml,md}": [
        "prettier --write"
      ],
      "package.json": [
        "syncpack lint"
      ]
    }
  }
  ```
- **Why:** Running ESLint with `--fix` and then Prettier in sequence ensures ESLint auto-fixable issues are resolved before Prettier re-formats. `syncpack lint` on `package.json` catches version mismatches introduced by the staged `package.json` changes.

### [RECOMMENDED] `--max-warnings 0` in the lint-staged ESLint command
- **What:** Treat any ESLint warning as a failure in the pre-commit hook.
- **Why:** Warnings tend to accumulate silently. Treating them as errors in the commit hook forces immediate resolution. If a warning is intentional, suppress it with an inline `// eslint-disable-next-line` comment with a justification.

### [SUGGESTED] `.husky/commit-msg` hook for conventional commits
- **What:** Add a commit-msg hook to validate commit message format.
- **Config:**
  ```sh
  # .husky/commit-msg
  pnpm dlx commitlint --edit "$1"
  ```
  ```js
  // commitlint.config.js
  export default {
    extends: ["@commitlint/config-conventional"],
  };
  ```
- **Why:** Conventional commit messages enable automated changelog generation and semantic versioning. This is optional — only add it if the team has adopted the conventional commits standard.

## Configuration

Full install sequence:
```sh
# Install tools at workspace root
pnpm add -D husky lint-staged -w

# Initialize husky (creates .husky/ and adds prepare script)
pnpm dlx husky init

# Verify the pre-commit hook
cat .husky/pre-commit
# Should contain: pnpm lint-staged
```

Root `package.json` after init:
```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --max-warnings 0 --fix", "prettier --write"],
    "*.{js,mjs,cjs}": ["eslint --max-warnings 0 --fix", "prettier --write"],
    "*.{json,yaml,yml,md}": ["prettier --write"],
    "package.json": ["syncpack lint"]
  }
}
```

## Common Pitfalls

- Committing `.husky/pre-commit` without execute permission: The hook file must be executable (`chmod +x .husky/pre-commit`). `husky init` sets this automatically, but manual file creation may not. Symptom: Git skips the hook silently.
- Running `eslint` without a path in lint-staged: lint-staged passes staged file paths as arguments. If you run `turbo run lint` instead of `eslint --fix`, turbo will re-lint all files in all packages, not just staged files — defeating the purpose of lint-staged.
- Using Husky v8 syntax (`huskyrc`, `"hooks"` key in `package.json`): Husky v9 ignores these entirely. There is no backwards compatibility. Remove old config and recreate hooks as shell scripts in `.husky/`.
- `prepare` script failing in CI: CI environments often run `pnpm install --frozen-lockfile` in a non-interactive mode. Add `"prepare": "husky || true"` if your CI user does not have a home directory, or set the `CI` environment variable — Husky v9 automatically skips install when `CI=true`.
- Forgetting `pnpm lint-staged` in the hook (running `npx lint-staged` instead): In a pnpm workspace, always use `pnpm` to run local binaries. Using `npx` may resolve to a globally installed version that differs from the pinned workspace version.
