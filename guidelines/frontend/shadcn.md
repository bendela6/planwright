# Shadcn UI Guidelines

## Overview
Shadcn UI is not an installed library — it is a collection of accessible, composable components you copy into your project. Components are built on Radix UI primitives and styled with Tailwind v4. You own the source, so you can modify any component freely. The canonical component registry is at `ui.shadcn.com`.

## Rules

### [REQUIRED] Install components via CLI, never manually copy
- **What:** Use `npx shadcn@latest add [component]` to add components. The CLI handles dependency installation, file placement, and `components.json` registration.
- **Config:**
  ```bash
  # Add a single component
  npx shadcn@latest add button

  # Add multiple components
  npx shadcn@latest add dialog sheet toast form

  # Update components.json config
  npx shadcn@latest init
  ```
- **Why:** The CLI writes the correct file path, installs Radix dependencies, and respects your `components.json` configuration.

### [REQUIRED] Shared components in `packages/ui/`, app-specific in `apps/web/src/components/ui/`
- **What:** Components used across multiple apps live in `packages/ui/src/`. Components specific to one app live in `apps/web/src/components/ui/`. Configure the output path in `components.json`.
- **Config:**
  ```json
  // packages/ui/components.json
  {
    "$schema": "https://ui.shadcn.com/schema.json",
    "style": "new-york",
    "rsc": false,
    "tsx": true,
    "tailwind": {
      "css": "src/styles/globals.css",
      "baseColor": "neutral",
      "cssVariables": true
    },
    "aliases": {
      "components": "@repo/ui/components",
      "utils": "@repo/ui/lib/utils"
    }
  }
  ```
- **Why:** Monorepo consumers `import { Button } from '@repo/ui'`. Per-app overrides stay local to avoid polluting shared components.

### [REQUIRED] Theming via CSS variables, not Tailwind config
- **What:** All shadcn component theming uses CSS custom properties. Define tokens in your `@theme` block in CSS. Do not pass color values through Tailwind configuration.
- **Config:**
  ```css
  /* packages/config/tailwind-preset.css */
  @import "tailwindcss";

  @theme {
    /* Shadcn semantic tokens */
    --color-background: oklch(1 0 0);
    --color-foreground: oklch(0.09 0.01 260);
    --color-card: oklch(1 0 0);
    --color-card-foreground: oklch(0.09 0.01 260);
    --color-popover: oklch(1 0 0);
    --color-popover-foreground: oklch(0.09 0.01 260);
    --color-primary: oklch(0.55 0.20 260);
    --color-primary-foreground: oklch(0.98 0 0);
    --color-secondary: oklch(0.96 0 0);
    --color-secondary-foreground: oklch(0.09 0.01 260);
    --color-muted: oklch(0.96 0 0);
    --color-muted-foreground: oklch(0.45 0 0);
    --color-accent: oklch(0.96 0 0);
    --color-accent-foreground: oklch(0.09 0.01 260);
    --color-destructive: oklch(0.58 0.22 25);
    --color-border: oklch(0.90 0 0);
    --color-input: oklch(0.90 0 0);
    --color-ring: oklch(0.55 0.20 260);
    --radius: 0.5rem;
  }

  @media (prefers-color-scheme: dark) {
    @theme {
      --color-background: oklch(0.09 0.01 260);
      --color-foreground: oklch(0.98 0 0);
      --color-card: oklch(0.09 0.01 260);
      --color-card-foreground: oklch(0.98 0 0);
      --color-primary: oklch(0.65 0.18 260);
      --color-primary-foreground: oklch(0.09 0.01 260);
      --color-secondary: oklch(0.17 0.01 260);
      --color-secondary-foreground: oklch(0.98 0 0);
      --color-muted: oklch(0.17 0.01 260);
      --color-muted-foreground: oklch(0.63 0 0);
      --color-border: oklch(0.20 0.01 260);
      --color-input: oklch(0.20 0.01 260);
    }
  }
  ```
- **Why:** Components reference these tokens via `bg-background`, `text-foreground`, etc. All of Shadcn's color utilities map directly to these CSS variables.

### [REQUIRED] Forms use `react-hook-form` + Valibot, not Zod
- **What:** Shadcn's Form component integrates with `react-hook-form`. The project uses Valibot as the schema validator. Use `@hookform/resolvers/valibot` — not the default Zod resolver.
- **Config:**
  ```ts
  // Install the Valibot resolver
  // pnpm add valibot @hookform/resolvers
  ```
  ```tsx
  import { useForm } from 'react-hook-form';
  import { valibotResolver } from '@hookform/resolvers/valibot';
  import * as v from 'valibot';
  import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
  import { Input } from '@/components/ui/input';
  import { Button } from '@/components/ui/button';

  const loginSchema = v.object({
    email:    v.pipe(v.string(), v.email('Invalid email address')),
    password: v.pipe(v.string(), v.minLength(8, 'Password must be at least 8 characters')),
  });

  type LoginForm = v.InferOutput<typeof loginSchema>;

  export function LoginForm() {
    const form = useForm<LoginForm>({
      resolver: valibotResolver(loginSchema),
      defaultValues: { email: '', password: '' },
    });

    const onSubmit = (data: LoginForm) => { /* ... */ };

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit">Log in</Button>
        </form>
      </Form>
    );
  }
  ```
- **Why:** Valibot is the project-standard schema library (also used in TanStack Router search params). Zod is not installed. Using both would introduce duplication.

### [REQUIRED] Never modify installed component source for one-off styling
- **What:** Do not edit `button.tsx`, `dialog.tsx`, etc. for per-instance style changes. Use `className` props and Tailwind utilities at the call site, or create a wrapper component.
- **Config:**
  ```tsx
  // Wrong: editing button.tsx directly for a specific case
  // components/ui/button.tsx — do not add ad-hoc classes here

  // Correct: pass className at the call site
  <Button className="w-full">Submit</Button>

  // Correct: create a named wrapper for a recurring variant
  // components/DangerButton.tsx
  export function DangerButton(props: React.ComponentProps<typeof Button>) {
    return <Button variant="destructive" {...props} />;
  }
  ```
- **Why:** Edited base components cannot be cleanly re-generated from the CLI. Wrapper components keep the contract explicit.

### [RECOMMENDED] Prefer Radix primitives for custom unstyled components
- **What:** When building a custom interactive component not available in the Shadcn registry, use the corresponding Radix UI primitive directly rather than building from HTML.
- **Config:**
  ```tsx
  import * as Popover from '@radix-ui/react-popover';
  // Style with Tailwind utilities
  ```
- **Why:** Radix handles accessibility (ARIA attributes, keyboard navigation, focus trapping) correctly. Building from scratch risks accessibility regressions.

## Configuration

### `components.json` for `apps/web`
```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### `lib/utils.ts` (generated by `shadcn init`)
```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## Common Pitfalls

- **Using `npx shadcn-ui@latest`:** The old package name. Use `npx shadcn@latest` (without `-ui`).
- **Using Zod in forms:** The project uses Valibot. Use `valibotResolver` from `@hookform/resolvers/valibot`.
- **Hardcoding hex or HSL colors in component classes:** Use semantic token utilities (`bg-primary`, `text-muted-foreground`) so dark mode works automatically.
- **Placing shared components in `apps/web/`:** Components used by more than one app belong in `packages/ui/` so they can be imported by any app in the monorepo.
- **Skipping `cn()` for conditional classes:** Always compose class names through `cn()` — it handles Tailwind class conflicts (e.g., two `p-*` values) correctly via `tailwind-merge`.
- **Importing from `@radix-ui/*` when a Shadcn wrapper exists:** If Shadcn wraps the Radix primitive (Dialog, Popover, Select, etc.), use the Shadcn wrapper — it comes pre-styled and pre-tested.
