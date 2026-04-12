# Syncpack Guidelines

## Overview
Syncpack enforces consistent dependency versions across all `package.json` files in the monorepo. In a workspace with many packages, the same dependency (e.g. `zod`, `react`) can easily drift to different versions across packages, causing duplicate bundles and subtle runtime mismatches. Syncpack finds and fixes these mismatches automatically.

## Rules

### [RECOMMENDED] `.syncpackrc` at repo root
- **What:** Configure syncpack with version groups, semver range policies, and which `package.json` fields to check.
- **Config:**
  ```json
  {
    "$schema": "https://unpkg.com/syncpack@latest/schema.json",
    "semverRange": "",
    "sortAz": [
      "contributors",
      "dependencies",
      "devDependencies",
      "keywords",
      "peerDependencies",
      "scripts"
    ],
    "sortFirst": ["name", "version", "private", "description"],
    "source": ["package.json", "apps/*/package.json", "packages/*/package.json"],
    "versionGroups": [
      {
        "label": "Internal workspace packages — always workspace:*",
        "packages": ["**"],
        "dependencies": ["@project/**"],
        "pinVersion": "workspace:*"
      },
      {
        "label": "Node.js type definitions must match TypeScript target",
        "packages": ["**"],
        "dependencies": ["@types/node"],
        "pinVersion": "22.x"
      },
      {
        "label": "React ecosystem — must be identical across all packages",
        "packages": ["**"],
        "dependencies": ["react", "react-dom", "@types/react", "@types/react-dom"],
        "policy": "sameRange"
      },
      {
        "label": "All other deps — ban ranges, use exact versions",
        "packages": ["**"],
        "dependencies": ["**"],
        "policy": "sameRange"
      }
    ]
  }
  ```
- **Why:** `semverRange: ""` means exact versions by default (no `^` or `~`). This is the strictest policy — every package in the monorepo pins to the same exact version, making deduplication predictable. If your team prefers ranges, use `"semverRange": "^"` but then the `sameRange` policy ensures all packages use the same range expression.

### [RECOMMENDED] Semver range policy: exact pinning or uniform ranges
- **What:** Choose one policy and enforce it across the entire repo. The two practical choices are:
  - **Exact** (`semverRange: ""`): Every dep is `"1.2.3"` — zero ambiguity, maximally reproducible.
  - **Minor range** (`semverRange: "^"`): Every dep is `"^1.2.3"` — allows patch/minor updates within `pnpm update`, still deduplicated.
- **Why:** Mixing exact and range versions within a monorepo means packages that depend on each other can end up with incompatible resolved versions. pnpm can deduplicate only when the ranges are compatible.

### [RECOMMENDED] `pinVersion: "workspace:*"` for internal packages
- **What:** Internal `@project/*` packages are always pinned with the workspace protocol, never with a semver version.
- **Why:** Prevents a developer from accidentally publishing or resolving a stale version of an internal package from the registry.

### [RECOMMENDED] Root scripts for lint and fix
- **What:** Add `syncpack:lint` and `syncpack:fix` to the root `package.json`. These run at the root because they scan all `package.json` files.
- **Config:**
  ```json
  {
    "scripts": {
      "syncpack:lint": "syncpack lint",
      "syncpack:fix": "syncpack fix"
    }
  }
  ```
- **Why:** `syncpack lint` exits non-zero if any mismatches are found — use this in CI. `syncpack fix` rewrites `package.json` files to resolve mismatches — use this locally. Never run `syncpack fix` in CI; it modifies files without human review.

### [SUGGESTED] `sortAz` and `sortFirst` for consistent `package.json` formatting
- **What:** Keep dependency sections alphabetically sorted and ensure name/version come first.
- **Why:** Sorted `package.json` files minimize merge conflicts when multiple developers add dependencies in the same package. Alphabetical ordering also makes manual review faster.

## Configuration

Install:
```sh
pnpm add -D syncpack -w
```

Run lint check:
```sh
pnpm syncpack:lint
```

Fix all mismatches interactively (review changes in git before committing):
```sh
pnpm syncpack:fix
```

List all versions of a specific package across the monorepo:
```sh
pnpm syncpack list-mismatches
```

## Common Pitfalls

- Running `syncpack fix` in CI without review: It rewrites `package.json` files. In CI this creates uncommitted changes that cause the repo to appear dirty. Use `syncpack lint` in CI.
- Not including `apps/*/package.json` in `source`: By default syncpack only reads the root `package.json`. All workspace paths must be explicitly listed.
- Forgetting the `@project/**` workspace:* group: Without it, syncpack will flag `workspace:*` as a non-standard version string and try to "fix" it to a semver version.
- Using `semverRange: "^"` without `sameRange` policy: One package might have `"^1.2.3"` and another `"^1.0.0"`. Both satisfy the range policy but pnpm cannot deduplicate them, resulting in two copies of the package in the install.
- Not running syncpack in the `prepare` hook: Adding a new dependency to one package and forgetting to run syncpack means the mismatch is only caught in CI, not locally.
