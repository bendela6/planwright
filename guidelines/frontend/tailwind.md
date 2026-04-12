# Tailwind v4 Guidelines

## Overview
Tailwind CSS v4 is the utility-first CSS framework used across all web interfaces. v4 is a complete architectural shift from v3: configuration moves entirely into CSS using the `@theme` directive, the `tailwind.config.ts` file is eliminated, and Lightning CSS is used as the compiler. These guidelines enforce the v4 approach — v3 patterns are prohibited.

## Rules

### [REQUIRED] CSS-first configuration — no `tailwind.config.ts`
- **What:** All Tailwind configuration lives in a CSS file. There is no `tailwind.config.ts` or `tailwind.config.js`. Import Tailwind with a single line and customise via `@theme`.
- **Config:**
  ```css
  /* apps/web/src/styles/globals.css */
  @import "tailwindcss";
  @import "../../packages/config/tailwind-preset.css";
  ```
- **Why:** A single source of truth in CSS. No JavaScript config file to maintain alongside the CSS. v4's engine reads `@theme` and auto-generates utilities.

### [REQUIRED] `@theme` for all design token customisation
- **What:** Custom colors, fonts, spacing, breakpoints, and other design tokens are defined inside `@theme {}`. Tokens defined here automatically generate corresponding utility classes.
- **Config:**
  ```css
  @theme {
    /* Brand colors */
    --color-brand-50: oklch(0.97 0.01 260);
    --color-brand-500: oklch(0.55 0.2 260);
    --color-brand-900: oklch(0.25 0.12 260);

    /* Typography */
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, monospace;

    /* Custom breakpoints */
    --breakpoint-3xl: 1920px;

    /* Custom spacing */
    --spacing-18: 4.5rem;
  }
  ```
- **Why:** Tokens in `@theme` are exposed as CSS custom properties AND generate utilities like `bg-brand-500`, `text-brand-50`, `font-sans`, `breakpoint-3xl:`.

### [REQUIRED] Shared preset in `packages/config/`
- **What:** All shared tokens (brand colors, typography, spacing scale) live in a single CSS file at `packages/config/tailwind-preset.css`. Apps import this file.
- **Config:**
  ```css
  /* packages/config/tailwind-preset.css */
  @import "tailwindcss";

  @theme {
    --color-brand-500: oklch(0.55 0.2 260);
    --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
    /* ... all shared tokens */
  }
  ```
  ```css
  /* apps/web/src/styles/globals.css */
  @import "../../packages/config/tailwind-preset.css";

  /* App-specific overrides */
  @theme {
    --color-sidebar-bg: oklch(0.15 0 0);
  }
  ```
- **Why:** Guarantees visual consistency across all apps in the monorepo from a single location.

### [REQUIRED] Dark mode via `prefers-color-scheme` media query
- **What:** Dark mode is implemented using CSS media queries on design tokens, not a `.dark` class toggle. Override `@theme` values inside `@media (prefers-color-scheme: dark)`.
- **Config:**
  ```css
  @theme {
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.1 0 0);
    --color-surface: oklch(0.97 0 0);
  }

  @media (prefers-color-scheme: dark) {
    @theme {
      --color-background: oklch(0.1 0 0);
      --color-foreground: oklch(0.97 0 0);
      --color-surface: oklch(0.15 0 0);
    }
  }
  ```
- **Why:** Respects the OS-level preference without JavaScript. Eliminates flash-of-wrong-theme issues common with class-based toggles.

### [REQUIRED] Mobile-first responsive design
- **What:** Write base styles for mobile, use breakpoint prefixes to add larger-screen overrides. Never write desktop-first styles.
- **Config:**
  ```tsx
  // Correct: mobile base, scale up
  <div className="flex flex-col gap-4 md:flex-row md:gap-6 lg:gap-8">

  // Wrong: desktop base with overrides
  <div className="flex flex-row gap-8 max-md:flex-col max-md:gap-4">
  ```
- **Why:** The mobile-first cascade is lower specificity and easier to reason about.

### [RECOMMENDED] Utility class ordering convention
- **What:** Order classes by category: layout → box model → typography → visual → interactive → responsive/state.
- **Config:**
  ```tsx
  // Layout → spacing → sizing → typography → color → border → shadow → state
  <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 rounded-lg shadow-sm hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50">
  ```
- **Why:** Consistent ordering makes diffs easier to read and prevents duplicate utility confusion. Use the `prettier-plugin-tailwindcss` to enforce this automatically.

### [REQUIRED] Use `@theme inline` for component-scoped tokens
- **What:** When a token should be available as a CSS custom property for use in `style={}` or custom CSS but does NOT need to generate a utility class, use `@theme inline`.
- **Config:**
  ```css
  @theme inline {
    --animate-duration-fast: 150ms;
    --animate-duration-normal: 250ms;
  }
  ```
- **Why:** Prevents bloating the generated utility set with tokens that are only needed as CSS variables in component styles.

## Configuration

### Complete `globals.css` example
```css
@import "tailwindcss";
@import "../../packages/config/tailwind-preset.css";

/* App-specific tokens */
@theme {
  --color-sidebar-bg: oklch(0.12 0.01 260);
  --color-sidebar-fg: oklch(0.9 0 0);
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-sidebar-bg: oklch(0.08 0.01 260);
  }
}

/* Custom utilities not covered by Tailwind */
@utility focus-ring {
  outline: 2px solid var(--color-brand-500);
  outline-offset: 2px;
}
```

### `packages/config/tailwind-preset.css`
```css
@import "tailwindcss";

@theme {
  /* Colors — use OKLCH for perceptual uniformity */
  --color-brand-50:  oklch(0.97 0.01 260);
  --color-brand-100: oklch(0.93 0.03 260);
  --color-brand-200: oklch(0.86 0.07 260);
  --color-brand-500: oklch(0.55 0.20 260);
  --color-brand-600: oklch(0.47 0.20 260);
  --color-brand-900: oklch(0.25 0.12 260);

  /* Semantic tokens */
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.1 0 0);
  --color-muted:      oklch(0.55 0 0);
  --color-border:     oklch(0.88 0 0);

  /* Typography */
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(0.10 0 0);
    --color-foreground: oklch(0.97 0 0);
    --color-muted:      oklch(0.55 0 0);
    --color-border:     oklch(0.22 0 0);
  }
}
```

## Common Pitfalls

- **Using v3 `@tailwind` directives:** `@tailwind base`, `@tailwind components`, `@tailwind utilities` are v3 syntax. v4 uses `@import "tailwindcss"` only.
- **Creating a `tailwind.config.ts`:** This file is unused in v4. If you find yourself writing one, move the tokens into `@theme` in CSS instead.
- **HSL colors:** Prefer OKLCH. Shadcn v4 components use OKLCH. HSL still works but OKLCH provides perceptually uniform color scales.
- **Arbitrary value overuse:** `bg-[#ff0000]` breaks the design system. Always add a token to `@theme` instead of using arbitrary values for brand or semantic colors.
- **Purge/content configuration:** v4 auto-detects template files. Do not add a `content` array — it does not exist in v4 configuration.
- **`darkMode: 'class'` configuration:** This is a v3 option. v4 uses `@media (prefers-color-scheme: dark)` in CSS. If your design requires a user-toggled dark mode via a class, use `@custom-variant dark (&:where(.dark, .dark *))` instead.
