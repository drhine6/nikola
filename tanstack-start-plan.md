## Task 2: TanStack Start Frontend — Fantasy Basketball Dashboard

### Overview

Build a TanStack Start frontend that connects to the Convex backend and displays fantasy basketball data in a simple, functional dashboard. This is a learning project for TanStack Start. The Convex backend is being built in parallel — build against the query functions defined below and wire up once the backend is deployed.

### TanStack Start Setup

Set up the app using TanStack Start docs and conventions:

- **File-based routing** via TanStack Router (built into Start)
- **Convex integration** — wrap the app with `ConvexProvider` and use `useQuery` hooks for real-time subscriptions
- **TanStack Router devtools** — enable during development to learn the routing model
- Use Tailwind for styling

Since Convex handles real-time natively, most data should be fetched client-side via Convex `useQuery` hooks rather than route loaders. Use loaders only for initial page data or non-realtime needs.

### Routes

```
app/
  routes/
    __root.tsx        — root layout with ConvexProvider, nav bar
    index.tsx         — dashboard home / my team overview
    matchups.tsx      — current week's matchup, head-to-head scoring
    standings.tsx     — league standings table
    free-agents.tsx   — available players sorted by recent performance
    sync-log.tsx      — sync history for debugging
```

### Pages

- **My Team (index)** — current roster with player stats (ppg, rpg, apg, etc.), injury status, position
- **Matchups** — current week's matchup, head-to-head category or points breakdown vs opponent
- **Standings** — league standings table with record, points for/against
- **Free Agents** — available players sorted by recent performance, with key stat columns
- **Sync Log** — table of recent syncs with timestamp, type, record counts, status/errors for debugging

### Convex Query Functions to Consume

The backend task is building these query functions — build your UI against them:

- `api.queries.getMyRoster` — returns current roster with player stats
- `api.queries.getCurrentMatchup` — returns this week's matchup with scoring breakdown
- `api.queries.getStandings` — returns league standings
- `api.queries.getFreeAgents` — returns available players sorted by recent performance
- `api.queries.getSyncLog` — returns recent sync history with status/errors
- `api.queries.getLeagueConfig` — returns league settings and scoring config

Use Convex `useQuery` hooks to subscribe to these. The data will update in real-time as the backend syncs new data.

### UI Guidelines

- Use neobrutalism design
- Use Tailwind for quick styling, no component library needed
- Simple nav bar with links to each page
- Tables for data-heavy views (standings, free agents, sync log)
- Cards or a clean layout for roster and matchup views
- Show a "last synced" timestamp somewhere visible so you know data is fresh
- Handle loading and empty states gracefully (data may not exist until the backend runs its first sync)

### Environment Variables

TanStack Start app only needs:

- `CONVEX_URL` — Convex deployment URL

### Notes

- Refer to the TanStack Start docs (https://tanstack.com/start/latest) for setup and conventions. The framework is relatively new so lean on the official docs and examples rather than assumptions.
- For Convex + TanStack Start integration, check the Convex docs for any existing TanStack Start guides or examples. If none exist, follow the generic React setup pattern with `ConvexProvider` at the root layout.
- Focus on learning TanStack Start patterns — file-based routing, loaders, server functions, the router devtools.
- The frontend can be developed with mock/empty data until the backend is deployed and syncing. Build the UI structure first, then wire up real queries.
- Don't over-engineer — you can always iterate later.

### Dependencies

`convex`, `@tanstack/react-start`, `@tanstack/react-router`, `react`, `tailwindcss`
