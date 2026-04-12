# TanStack Query Guidelines

## Overview
TanStack Query v5 manages all server state: fetching, caching, synchronisation, and mutation. It is the only data-fetching layer — do not use `useEffect` + `fetch` directly in components. TanStack Query integrates with TanStack Router loaders for prefetching.

## Rules

### [REQUIRED] Query key factory pattern
- **What:** Define all query keys for a domain in a single factory object. Never write inline query keys inside components.
- **Config:**
  ```ts
  // queries/userQueries.ts
  import { queryOptions } from '@tanstack/react-query';
  import { api } from '@/lib/api';

  export const userKeys = {
    all:    ()                      => ['users'] as const,
    lists:  ()                      => [...userKeys.all(), 'list'] as const,
    list:   (filters: UserFilters)  => [...userKeys.lists(), filters] as const,
    details:()                      => [...userKeys.all(), 'detail'] as const,
    detail: (id: string)            => [...userKeys.details(), id] as const,
  } as const;
  ```
- **Why:** Centralised keys make invalidation precise (invalidate all user queries, or just one detail) and eliminate key typos.

### [REQUIRED] `queryOptions` API for all query definitions
- **What:** Wrap every query in `queryOptions()` from `@tanstack/react-query`. This creates a reusable, type-safe query configuration object that can be passed to `useQuery`, `prefetchQuery`, and `ensureQueryData` identically.
- **Config:**
  ```ts
  // queries/userQueries.ts
  import { queryOptions, infiniteQueryOptions } from '@tanstack/react-query';

  export const userQueries = {
    detail: (userId: string) =>
      queryOptions({
        queryKey: userKeys.detail(userId),
        queryFn: () => api.users.getById(userId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),

    list: (filters: UserFilters) =>
      queryOptions({
        queryKey: userKeys.list(filters),
        queryFn: () => api.users.list(filters),
        staleTime: 60 * 1000, // 1 minute
      }),
  };

  // In a component:
  const { data: user } = useQuery(userQueries.detail(userId));

  // In a router loader:
  loader: ({ params }) => queryClient.ensureQueryData(userQueries.detail(params.userId)),
  ```
- **Why:** One definition, used everywhere. Changes to `staleTime` or `queryFn` apply uniformly to component usage and loader prefetching.

### [REQUIRED] Mutation patterns with invalidation on settle
- **What:** Always invalidate affected queries in `onSettled` (not `onSuccess`) so that the cache is refreshed even when the mutation errors. Use `onMutate` for optimistic updates.
- **Config:**
  ```ts
  // Mutation without optimistic update
  const updateUser = useMutation({
    mutationFn: (data: UpdateUserInput) => api.users.update(data),
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.userId) });
      queryClient.invalidateQueries({ queryKey: userKeys.lists() });
    },
  });
  ```
- **Why:** `onSuccess` is skipped on network failure. `onSettled` always runs, ensuring the cache never stays in a stale-optimistic state after an error.

### [REQUIRED] Optimistic updates with rollback
- **What:** For fast-feedback mutations (toggles, reorders), use `onMutate` to update the cache immediately. Always return the previous snapshot as context so `onError` can roll back.
- **Config:**
  ```ts
  const toggleUserActive = useMutation({
    mutationFn: (userId: string) => api.users.toggleActive(userId),
    onMutate: async (userId) => {
      // Cancel outgoing refetches to prevent overwrite
      await queryClient.cancelQueries({ queryKey: userKeys.detail(userId) });

      // Snapshot for rollback
      const previous = queryClient.getQueryData(userKeys.detail(userId));

      // Optimistic update
      queryClient.setQueryData(userKeys.detail(userId), (old: User) => ({
        ...old,
        isActive: !old.isActive,
      }));

      return { previous, userId };
    },
    onError: (_err, _userId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(userKeys.detail(context.userId), context.previous);
      }
    },
    onSettled: (_data, _error, userId) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) });
    },
  });
  ```
- **Why:** `cancelQueries` prevents an in-flight refetch from overwriting the optimistic state. Rollback in `onError` keeps the UI truthful on failure.

### [REQUIRED] Infinite queries for paginated lists
- **What:** Use `useInfiniteQuery` with `infiniteQueryOptions` for any list that loads more items. Use cursor-based pagination, not page-number-based.
- **Config:**
  ```ts
  export const userQueries = {
    // ...
    infinite: (filters: Omit<UserFilters, 'cursor'>) =>
      infiniteQueryOptions({
        queryKey: [...userKeys.lists(), 'infinite', filters],
        queryFn: ({ pageParam }) =>
          api.users.list({ ...filters, cursor: pageParam }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      }),
  };

  // In component:
  const { data, fetchNextPage, hasNextPage } = useInfiniteQuery(
    userQueries.infinite({ status: 'active' }),
  );
  ```

### [REQUIRED] Prefetching in router loaders
- **What:** Prefetch queries in TanStack Router loaders so data is ready before the component mounts. Use `ensureQueryData` (awaits if missing, returns from cache if fresh) rather than `prefetchQuery` (fire-and-forget).
- **Config:**
  ```ts
  const userDetailRoute = createRoute({
    // ...
    loader: async ({ params, context: { queryClient } }) => {
      // Blocks navigation until data is available
      await queryClient.ensureQueryData(userQueries.detail(params.userId));
    },
  });
  ```
- **Why:** `ensureQueryData` respects `staleTime` — it won't refetch if the cache is fresh. The component renders with data immediately, no loading spinner needed for the initial load.

### [RECOMMENDED] Error and loading state handling
- **What:** Always handle `isLoading`, `isError`, and `data` from `useQuery`. For prefetched routes, `isLoading` is always false on mount — but `isError` must still be handled.
- **Config:**
  ```tsx
  function UserDetail({ userId }: { userId: string }) {
    const { data: user, isError, error } = useQuery(userQueries.detail(userId));

    if (isError) return <ErrorMessage error={error} />;
    if (!user)   return <UserDetailSkeleton />;

    return <UserCard user={user} />;
  }
  ```

## Configuration

### QueryClient setup
```ts
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,        // 1 minute — tune per domain
      gcTime:    5 * 60 * 1000,    // 5 minutes garbage collection
      retry: 1,
      refetchOnWindowFocus: false, // disable for data that rarely changes
    },
    mutations: {
      retry: 0,
    },
  },
});
```

### DevTools setup
```tsx
// main.tsx (development only)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
  {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
</QueryClientProvider>
```

## Common Pitfalls

- **Inline query keys:** `useQuery({ queryKey: ['users', userId] })` in a component cannot be invalidated reliably. Always use the factory.
- **Invalidating in `onSuccess`:** Network errors skip `onSuccess`. Move cache invalidation to `onSettled`.
- **Missing `cancelQueries` before optimistic update:** Without cancellation, an in-flight response can overwrite your optimistic change.
- **Using `prefetchQuery` in loaders when you want blocking behaviour:** `prefetchQuery` returns immediately; `ensureQueryData` awaits. Use `ensureQueryData` in loaders that should block navigation.
- **`staleTime: 0` globally:** Zero stale time means every mount triggers a refetch. Set appropriate stale times per query domain (reference data: long; user-generated: short).
- **Calling `queryClient.invalidateQueries` without a key:** `invalidateQueries({})` invalidates the entire cache. Always pass a scoped key.
