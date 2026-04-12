# React Guidelines

## Overview
React is the UI library for all web interfaces. These guidelines enforce structural consistency across the monorepo so that any developer can navigate any component without orientation time.

## Rules

### [REQUIRED] One component per file
- **What:** Every React component lives in its own file. No co-located helper components exported alongside a main component.
- **Why:** File-per-component makes search, refactoring, and code review predictable. It also enforces that components are small enough to stand alone.

### [REQUIRED] PascalCase filename matches component name
- **What:** The file name must exactly match the default export's component name. `UserCard.tsx` exports `function UserCard`.
- **Why:** Consistency with auto-import tooling and instant recognition of component files vs utilities.

### [REQUIRED] Props interface declared directly before the component
- **What:** Define a `Props` interface (or a descriptive name like `UserCardProps`) in the same file, immediately above the component function. Do not export it unless it is consumed by another file.
- **Config:**
  ```tsx
  // UserCard.tsx
  interface UserCardProps {
    userId: string;
    displayName: string;
    avatarUrl?: string;
  }

  export function UserCard({ userId, displayName, avatarUrl }: UserCardProps) {
    // ...
  }
  ```
- **Why:** Co-location reduces the distance between interface and implementation. Avoid exporting unless another component explicitly needs the type — premature export creates implicit API surface.

### [REQUIRED] Custom hooks in `hooks/` directory
- **What:** Any reusable stateful logic extracted from components goes in `apps/web/src/hooks/`. The file name must start with `use` and be camelCase: `useUserProfile.ts`.
- **Config:**
  ```
  apps/web/src/hooks/
    useUserProfile.ts
    useDebounce.ts
    useBreakpoint.ts
  ```
- **Why:** Keeps component files focused on rendering. Hooks directory is the canonical first place to look for reusable logic.

### [REQUIRED] React Context for client-side shared state
- **What:** Use React's built-in `createContext` + `useReducer` (or `useState`) for shared UI state. Do not introduce Zustand, Jotai, Redux, or any other state management library.
- **Config:**
  ```tsx
  // context/AuthContext.tsx
  interface AuthState {
    user: User | null;
    isLoading: boolean;
  }

  const AuthContext = createContext<AuthState | null>(null);

  export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(authReducer, initialState);
    return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
  }

  export function useAuth(): AuthState {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
  }
  ```
- **Why:** Avoids adding a dependency for a problem React already solves. Server state is handled by TanStack Query, leaving React Context purely for UI/session state.

### [REQUIRED] Error boundaries wrapping page-level trees
- **What:** Every top-level page component must be wrapped by an `ErrorBoundary`. Use a shared boundary from `packages/ui/` or the one provided by `react-error-boundary`.
- **Config:**
  ```tsx
  // pages/DashboardPage.tsx
  import { ErrorBoundary } from 'react-error-boundary';
  import { DashboardErrorFallback } from '@/components/DashboardErrorFallback';

  export function DashboardPage() {
    return (
      <ErrorBoundary FallbackComponent={DashboardErrorFallback}>
        <DashboardContent />
      </ErrorBoundary>
    );
  }
  ```
- **Why:** Unhandled render errors should degrade gracefully, not blank the entire app. Error boundaries provide the isolation point.

### [RECOMMENDED] Collocate page-specific components near the page
- **What:** Components that are only used by a single page live under `pages/Dashboard/components/`, not in the global `components/` directory.
- **Why:** Makes it clear what can safely be deleted when a page is removed.

## Configuration

### Directory structure for `apps/web/src/`
```
apps/web/src/
  components/          # Shared components used across multiple pages
    ui/                # Shadcn-generated UI primitives
    layout/            # Shell, Sidebar, Header, etc.
  pages/               # One folder per route/page
    Dashboard/
      DashboardPage.tsx
      components/      # Page-local components
      hooks/           # Page-local hooks
  hooks/               # Shared custom hooks
  context/             # React Contexts
  utils/               # Pure functions, formatters, helpers
  types/               # Shared TypeScript types and interfaces
```

### Component template
```tsx
// components/UserCard.tsx
import type { User } from '@/types/user';

interface UserCardProps {
  user: User;
  onSelect?: (id: string) => void;
}

export function UserCard({ user, onSelect }: UserCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <p className="font-medium">{user.displayName}</p>
      {onSelect && (
        <button onClick={() => onSelect(user.id)}>Select</button>
      )}
    </div>
  );
}
```

## Common Pitfalls

- **Default exports vs named exports:** Use named exports for all components. Default exports make refactoring harder because the import name can drift from the component name.
- **Prop drilling beyond two levels:** If you find yourself passing a prop through three or more components, introduce a Context or co-locate the state closer to where it is used.
- **Hooks in non-hook files:** Never put a `use*` function in a `utils/` file. If it calls a React hook, it belongs in `hooks/`.
- **Global component pollution:** Adding page-specific components to `components/` inflates the shared namespace. Apply the page-local colocation rule strictly.
- **Missing loading/error states:** Every component that fetches data (via TanStack Query) must render a meaningful loading skeleton and an error state — not just a spinner and nothing else.
