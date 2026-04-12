# TanStack Router Guidelines

## Overview
TanStack Router is the type-safe client-side router for all web apps. This project uses **config-based (code-based) routing** — not file-based routing. Route trees are defined explicitly in TypeScript using `createRootRoute`, `createRoute`, and `createRouter`. File-based routing (and TanStack Start) are not used.

## Rules

### [REQUIRED] Config-based route tree — no file-based routing
- **What:** Define all routes in `apps/web/src/router/` using `createRootRoute` and `createRoute`. Do not use the file-based routing plugin (`@tanstack/router-plugin` or `routeTree.gen.ts`).
- **Why:** Config-based routing keeps the full route tree visible in one place, avoids magic file-name conventions, and gives complete control over code splitting.

### [REQUIRED] Route tree defined in `router/index.ts`
- **Config:**
  ```ts
  // apps/web/src/router/index.ts
  import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
  import { RootLayout } from '@/components/layout/RootLayout';
  import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
  import { LoginPage } from '@/pages/Login/LoginPage';
  import { UsersPage } from '@/pages/Users/UsersPage';
  import { UserDetailPage } from '@/pages/Users/UserDetailPage';

  const rootRoute = createRootRoute({
    component: RootLayout,
  });

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    component: LoginPage,
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: DashboardPage,
  });

  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users',
    component: UsersPage,
  });

  const userDetailRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: '$userId',
    component: UserDetailPage,
  });

  const routeTree = rootRoute.addChildren([
    loginRoute,
    dashboardRoute,
    usersRoute.addChildren([userDetailRoute]),
  ]);

  export const router = createRouter({ routeTree });

  declare module '@tanstack/react-router' {
    interface Register {
      router: typeof router;
    }
  }
  ```
- **Why:** The module augmentation on `Register` enables full type safety on `Link`, `useParams`, `useSearch`, and `navigate` across the entire app.

### [REQUIRED] Route loaders for data fetching
- **What:** Use the `loader` property on each route to prefetch data before the component renders. Integrate with TanStack Query via `ensureQueryData`.
- **Config:**
  ```ts
  import { queryClient } from '@/lib/queryClient';
  import { userQueries } from '@/queries/userQueries';

  const userDetailRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: '$userId',
    loader: ({ params, context }) =>
      queryClient.ensureQueryData(userQueries.detail(params.userId)),
    component: UserDetailPage,
  });
  ```
- **Why:** Loaders enable parallel data fetching with navigation, eliminating waterfall loading states inside components.

### [REQUIRED] Search params validation with Valibot
- **What:** Validate all search parameters using Valibot via the `validateSearch` option. Never access `window.location.search` directly.
- **Config:**
  ```ts
  import * as v from 'valibot';

  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users',
    validateSearch: v.object({
      page:   v.optional(v.pipe(v.number(), v.minValue(1)), 1),
      query:  v.optional(v.string(), ''),
      status: v.optional(v.picklist(['active', 'inactive']), 'active'),
    }),
    component: UsersPage,
  });

  // Inside UsersPage:
  function UsersPage() {
    const { page, query, status } = usersRoute.useSearch();
    // page, query, status are fully typed
  }
  ```
- **Why:** Search params are a serialisation boundary. Validation with Valibot gives type safety, default values, and runtime correctness guarantees.

### [REQUIRED] Route guards using `beforeLoad`
- **What:** Authentication and authorisation checks go in `beforeLoad`. Redirect unauthenticated users before any data loading begins.
- **Config:**
  ```ts
  import { redirect } from '@tanstack/react-router';
  import { getSession } from '@/lib/session';

  const protectedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    beforeLoad: async ({ location }) => {
      const session = await getSession();
      if (!session) {
        throw redirect({
          to: '/login',
          search: { returnTo: location.href },
        });
      }
    },
    component: DashboardPage,
  });
  ```
- **Why:** `beforeLoad` runs before `loader`, making it the correct guard point. Throwing a redirect is type-safe and composable.

### [REQUIRED] Nested layouts via route hierarchy
- **What:** Shared UI shells (sidebars, navbars, breadcrumb bars) are rendered by layout routes. Layout routes have no `path` or a path that their children extend.
- **Config:**
  ```ts
  const authenticatedLayoutRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'authenticated',   // layout route — no path, uses `id`
    component: AuthenticatedLayout,
    beforeLoad: async () => { /* auth check */ },
  });

  const dashboardRoute = createRoute({
    getParentRoute: () => authenticatedLayoutRoute,
    path: '/',
    component: DashboardPage,
  });
  ```
- **Why:** Layout routes apply `beforeLoad` and render chrome once for all child routes, avoiding code duplication.

### [REQUIRED] Type-safe navigation with `Link` and `useNavigate`
- **What:** Use TanStack Router's `<Link>` component and `useNavigate` hook. Never use `<a href>` for internal navigation.
- **Config:**
  ```tsx
  import { Link, useNavigate } from '@tanstack/react-router';

  // Declarative navigation
  <Link to="/users/$userId" params={{ userId: user.id }}>
    View profile
  </Link>

  // With search params
  <Link to="/users" search={{ page: 2, status: 'active' }}>
    Next page
  </Link>

  // Programmatic navigation
  const navigate = useNavigate();
  await navigate({ to: '/dashboard' });
  ```
- **Why:** The `to` prop, `params`, and `search` are all statically typed against the registered route tree, catching broken links at compile time.

## Configuration

### Router provider setup in `main.tsx`
```tsx
// apps/web/src/main.tsx
import { RouterProvider } from '@tanstack/react-router';
import { router } from '@/router';
import { queryClient } from '@/lib/queryClient';

const rootElement = document.getElementById('root')!;
createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>,
);
```

### Passing QueryClient as router context
```ts
// router/index.ts
export const router = createRouter({
  routeTree,
  context: { queryClient },
});

// Route loaders can then access queryClient from context:
loader: ({ context: { queryClient }, params }) =>
  queryClient.ensureQueryData(userQueries.detail(params.userId)),
```

## Common Pitfalls

- **Using file-based routing:** Do not run `@tanstack/router-plugin`. Do not create a `routes/` directory with `__root.tsx` etc. This project uses config-based routing exclusively.
- **Skipping `validateSearch`:** Accessing raw search params without validation gives `unknown` types and allows corrupt URL state to reach components.
- **Auth checks in `loader` instead of `beforeLoad`:** `loader` runs after `beforeLoad`. Putting auth in `loader` means data fetching starts before the auth check completes.
- **Missing `Register` module augmentation:** Without it, `Link`'s `to` prop accepts any string, defeating type safety.
- **Forgetting `<Outlet />`:** Layout route components must render `<Outlet />` where child routes should appear. Omitting it causes child routes to render nothing.
