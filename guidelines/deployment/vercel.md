# Vercel Guidelines

## Overview
Vercel is the standard deployment target for the React frontend (`apps/web`). It provides automatic preview deploys per pull request, global CDN, and zero-config Vite support. These guidelines configure Vercel correctly for a Turborepo monorepo structure.

## Rules

### [REQUIRED] Set `rootDirectory` to `apps/web`
- **What:** In the Vercel project settings (or `vercel.json`), point the root directory at the frontend app, not the repo root.
- **Config:**
  ```json
  {
    "rootDirectory": "apps/web"
  }
  ```
- **Why:** Without this, Vercel tries to build from the monorepo root, which has no `package.json` build script it understands. Setting `rootDirectory` scopes the build context correctly.

### [REQUIRED] Set framework preset to Vite
- **What:** Specify `vite` as the framework so Vercel uses the correct build defaults.
- **Config:**
  ```json
  {
    "framework": "vite"
  }
  ```
  Or set via Vercel Dashboard: Project → Settings → General → Framework Preset → Vite.
- **Why:** The correct preset sets the right Node.js version, output directory detection, and SPA routing fallback (`index.html` for all 404s).

### [REQUIRED] Use Turbo build command scoped to the web app
- **What:** Override the default build command to run through Turborepo so the build cache is shared with CI.
- **Config:**
  ```json
  {
    "buildCommand": "cd ../.. && turbo run build --filter=@project/web"
  }
  ```
  Note: `cd ../..` navigates from `rootDirectory` back to the repo root where `turbo` is installed.
- **Why:** Running `turbo run build` ensures shared packages (`@project/ui`, `@project/api-contract`) are built before the web app and benefits from Turbo's remote cache on Vercel.

### [REQUIRED] Set `outputDirectory` explicitly
- **What:** Point Vercel at the correct build output folder.
- **Config:**
  ```json
  {
    "outputDirectory": "dist"
  }
  ```
- **Why:** Vite outputs to `dist` by default. Vercel may default to `.vercel/output` or `public` depending on framework detection. Explicit beats implicit.

### [REQUIRED] Store environment variables in Vercel Dashboard, not `vercel.json`
- **What:** All `VITE_*` environment variables go in Project → Settings → Environment Variables in the Vercel Dashboard.
- **Config:** Set per environment (Production, Preview, Development):
  ```
  VITE_API_URL          https://api.example.com          (Production)
  VITE_API_URL          https://api-staging.example.com  (Preview)
  VITE_POSTHOG_KEY      phc_xxxxx                        (Production + Preview)
  ```
- **Why:** `vercel.json` is committed to the repo. Secrets and environment-specific values must not be committed. Vercel injects env vars at build time for `VITE_` prefixed variables.

### [RECOMMENDED] Configure SPA routing rewrite
- **What:** Add a catch-all rewrite so deep-link navigation works on page refresh.
- **Config:**
  ```json
  {
    "rewrites": [
      { "source": "/((?!api/).*)", "destination": "/index.html" }
    ]
  }
  ```
- **Why:** TanStack Router uses client-side routing. Without this, a direct visit to `/dashboard/settings` returns a 404 from the CDN.

### [RECOMMENDED] Preview deploys are on by default — do not disable them
- **What:** Vercel creates a unique preview URL for every PR automatically. No extra config needed; just ensure the GitHub integration is connected.
- **Config:** No config required. Preview URL format: `https://my-app-git-branch-name-org.vercel.app`
- **Why:** Preview deploys are one of Vercel's key value propositions. They allow visual review of frontend changes without running anything locally.

## Configuration

Complete `vercel.json` for a monorepo frontend app:

```json
{
  "framework": "vite",
  "rootDirectory": "apps/web",
  "buildCommand": "cd ../.. && turbo run build --filter=@project/web",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

## Common Pitfalls

- **Building from repo root without `rootDirectory`**: Vercel finds no framework and either fails or deploys a blank page. Always set `rootDirectory`.
- **Using `npm run build` instead of `turbo run build`**: Bypasses Turborepo dependency graph — shared packages may not be built first, causing import resolution failures.
- **Committing `VITE_*` secrets in `vercel.json`**: Env vars in `vercel.json` are committed to git. Use the Vercel Dashboard for all environment variable configuration.
- **Missing SPA rewrite**: Refreshing any route other than `/` returns 404. The catch-all rewrite to `index.html` is required for client-side routers.
- **Not scoping environment variables to the right environments**: `VITE_API_URL` should point to prod in Production and staging in Preview. Using the same URL for both bypasses preview testing.
- **`turbo` not installed at repo root**: The Turbo build command navigates to the repo root to run `turbo`. Ensure `turbo` is in `devDependencies` at the root `package.json`.
