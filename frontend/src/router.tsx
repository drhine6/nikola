import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routerWithQueryClient } from '@tanstack/react-router-with-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider } from 'convex/react'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL

  if (!CONVEX_URL) {
    // Allow running without Convex for development
    const queryClient = new QueryClient()
    const router = routerWithQueryClient(
      createTanStackRouter({
        routeTree,
        defaultPreload: 'intent',
        context: { queryClient },
        scrollRestoration: true,
      }),
      queryClient,
    )
    return router
  }

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL)
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })

  convexQueryClient.connect(queryClient)

  const router = routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      defaultPreload: 'intent',
      context: { queryClient },
      scrollRestoration: true,
      Wrap: ({ children }) => (
        <ConvexProvider client={convexQueryClient.convexClient}>
          {children}
        </ConvexProvider>
      ),
    }),
    queryClient,
  )

  return router
}

let routerSingleton: ReturnType<typeof createRouter> | null = null

export function getRouter() {
  if (!routerSingleton) {
    routerSingleton = createRouter()
  }
  return routerSingleton
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
