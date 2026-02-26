import {
  Outlet,
  HeadContent,
  Scripts,
  Link,
} from '@tanstack/react-router'
import { createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Nikola - Fantasy Basketball Coach' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap',
      },
    ],
  }),
  component: RootComponent,
})

const navLinks = [
  { to: '/', label: 'My Team' },
  { to: '/matchups', label: 'Matchups' },
  { to: '/standings', label: 'Standings' },
  { to: '/free-agents', label: 'Free Agents' },
  { to: '/sync-log', label: 'Sync Log' },
] as const

function NavBar() {
  return (
    <nav className="bg-brutal-black text-brutal-white border-b-4 border-brutal-yellow">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <span className="text-brutal-yellow">NIKOLA</span>
          </Link>
          <div className="flex gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="px-3 py-2 text-sm font-bold uppercase tracking-wide hover:bg-brutal-yellow hover:text-brutal-black transition-colors"
                activeProps={{
                  className: 'bg-brutal-yellow text-brutal-black',
                }}
                activeOptions={{ exact: link.to === '/' }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

function RootComponent() {
  return (
    <RootDocument>
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-brutal-gray min-h-screen">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
