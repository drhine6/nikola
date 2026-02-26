## Task 1: Convex Backend — ESPN Fantasy Basketball Data Sync

### Overview

Build the Convex backend that syncs ESPN Fantasy league data and NBA player stats into Convex tables via cron jobs. Verify everything works via the Convex dashboard.

### Convex Schema

Design tables for:

- `leagues` — league config, scoring settings
- `teams` — fantasy teams, owners, standings
- `rosters` — current player-to-team assignments
- `matchups` — weekly matchup pairings and scores
- `players` — NBA player profiles
- `playerStats` — per-game and season average stats
- `games` — NBA game schedule, scores, status (scheduled/live/final)
- `syncLog` — track last sync timestamps per sync type

### Convex Structure

```
convex/
  schema.ts          — table definitions
  crons.ts           — cron job definitions
  espn.ts            — internal actions for ESPN API calls
  stats.ts           — internal actions for balldontlie API calls
  sync.ts            — orchestration logic (what to sync when)
  mutations.ts       — write functions for upserting data
  queries.ts         — read functions for the frontend (build these now so the frontend task can consume them)
```

### Convex Cron Jobs

Define in `convex/crons.ts`:

- **`syncLeague`** — runs every 6 hours. Full sync of rosters, matchups, standings, league config.
- **`syncLive`** — runs every 10 minutes. Checks the `games` table to see if any NBA games are currently in progress. If yes, syncs live scores, active player stats, and roster updates. If no games active, exits early.
- **`syncSchedule`** — runs once daily. Pulls the NBA game schedule for the day/week so `syncLive` knows when games are happening.

Each cron calls an internal action that does the fetching and writes results via mutations.

### ESPN Fantasy API (direct HTTP calls from Convex actions)

No Python — call the ESPN endpoints directly using `fetch` in Convex actions.

Key endpoints:

- `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/{year}/segments/0/leagues/{leagueId}` — base league endpoint
- Add query params like `?view=mRoster`, `?view=mMatchup`, `?view=mStandings`, `?view=mFreeAgents` to get specific data
- Auth via `espn_s2` and `SWID` cookies passed as headers: `Cookie: espn_s2={value}; SWID={value}` (env vars are set)

Data to sync:

- League config & scoring settings
- Team rosters (player-to-team assignments)
- Weekly matchup schedule & scores
- Standings
- Free agents / waiver wire

### Player Stats API (balldontlie.io)

Direct `fetch` calls from Convex actions. No auth required.

- Per-game box scores
- Season averages
- Today's game schedule and live scores
- Player profiles

Use this to determine if games are active (for the `syncLive` cron) and to pull individual player performance data.

### Query Functions for Frontend

Build these query functions in `queries.ts` so the frontend task can consume them immediately:

- `getMyRoster` — returns current roster with player stats
- `getCurrentMatchup` — returns this week's matchup with scoring breakdown
- `getStandings` — returns league standings
- `getFreeAgents` — returns available players sorted by recent performance
- `getSyncLog` — returns recent sync history with status/errors
- `getLeagueConfig` — returns league settings and scoring config

### Environment Variables

Store in Convex environment variables (dashboard or CLI):

- `ESPN_S2` — ESPN auth cookie
- `ESPN_SWID` — ESPN auth cookie
- `LEAGUE_ID` — your fantasy league ID
- `LEAGUE_YEAR` — current season year

### Notes

- All sync actions should be idempotent — safe to re-run without duplicating data. Use upsert patterns (query for existing record by ESPN ID, update or insert).
- Log every sync run to `syncLog` with timestamp, type, record counts, and any errors.
- ESPN cookies expire periodically — if a sync fails auth, log it clearly so you know to refresh them.
- The `syncLive` cron should be lightweight when no games are active — just check the `games` table and bail out early.
- Verify data is flowing correctly via the Convex dashboard before considering this task complete.
- The query functions are the contract with the frontend — name them clearly and type the return values so the frontend task can build against them.

### Dependencies

`convex`
