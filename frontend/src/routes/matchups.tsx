import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api, asNumber, convexArgs, formatAgoFromMs, isConvexEnabled } from '~/lib/convex-bridge'

export const Route = createFileRoute('/matchups')({
  component: Matchups,
})

// Mock data — will be replaced by Convex useQuery(api.queries.getCurrentMatchup)
const mockMatchup = {
  week: 18,
  myTeam: { name: "David's Team", record: '12-5-0' },
  opponent: { name: "Mike's Squad", record: '10-7-0' },
  categories: [
    { name: 'PTS', mine: 482.3, theirs: 456.1, winning: true },
    { name: 'REB', mine: 198.5, theirs: 210.2, winning: false },
    { name: 'AST', mine: 125.8, theirs: 118.4, winning: true },
    { name: 'STL', mine: 32.4, theirs: 28.9, winning: true },
    { name: 'BLK', mine: 18.2, theirs: 22.1, winning: false },
    { name: '3PM', mine: 45.6, theirs: 42.3, winning: true },
    { name: 'FG%', mine: 0.487, theirs: 0.472, winning: true },
    { name: 'FT%', mine: 0.815, theirs: 0.832, winning: false },
    { name: 'TO', mine: 42.1, theirs: 45.8, winning: true },
  ],
}

function toRecordString(team: any) {
  if (!team) return '—'
  const wins = asNumber(team.wins)
  const losses = asNumber(team.losses)
  const ties = asNumber(team.ties)
  return `${wins}-${losses}-${ties}`
}

function normalizeCategoryBreakdown(raw: any, matchup: any) {
  if (Array.isArray(raw)) {
    return raw.map((cat: any) => ({
      name: String(cat.name ?? cat.stat ?? 'CAT'),
      mine: asNumber(cat.mine ?? cat.home ?? cat.myScore),
      theirs: asNumber(cat.theirs ?? cat.away ?? cat.opponentScore),
      winning: Boolean(cat.winning),
    }))
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw)
      .filter(([, value]) => value && typeof value === 'object')
      .slice(0, 9)
      .map(([name, value]: [string, any]) => {
        const mine = asNumber(value.home ?? value.mine ?? value.value ?? 0)
        const theirs = asNumber(value.away ?? value.theirs ?? value.opponent ?? 0)
        const turnovers = name.toUpperCase() === 'TO'
        return {
          name: name.toUpperCase(),
          mine,
          theirs,
          winning: turnovers ? mine < theirs : mine > theirs,
        }
      })
    if (entries.length > 0) return entries
  }

  return [
    {
      name: 'TOTAL',
      mine: asNumber(matchup?.homeScore),
      theirs: asNumber(matchup?.awayScore),
      winning: asNumber(matchup?.homeScore) >= asNumber(matchup?.awayScore),
    },
  ]
}

function Matchups() {
  const matchupQuery = useQuery(convexQuery(api.queries.getCurrentMatchup, convexArgs({})))
  const syncLogQuery = useQuery(convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 })))

  const matchup = isConvexEnabled && matchupQuery.data
    ? {
        week: matchupQuery.data.matchupPeriodId ?? matchupQuery.data.scoringPeriodId ?? '—',
        myTeam: {
          name: matchupQuery.data.homeTeam?.name ?? `Team ${matchupQuery.data.homeTeamId}`,
          record: toRecordString(matchupQuery.data.homeTeam),
        },
        opponent: {
          name: matchupQuery.data.awayTeam?.name ?? `Team ${matchupQuery.data.awayTeamId}`,
          record: toRecordString(matchupQuery.data.awayTeam),
        },
        categories: normalizeCategoryBreakdown(matchupQuery.data.scoringBreakdown, matchupQuery.data),
      }
    : mockMatchup

  const myWins = matchup.categories.filter((c) => c.winning).length
  const theirWins = matchup.categories.filter((c) => !c.winning).length
  const lastSyncedMs = (syncLogQuery.data?.[0] as any)?.finishedAt ?? (syncLogQuery.data?.[0] as any)?.startedAt
  const lastSyncedLabel = isConvexEnabled ? formatAgoFromMs(lastSyncedMs) : '2 minutes ago'

  return (
    <div>
      <h1 className="text-3xl font-black uppercase mb-6">
        Week {matchup.week} Matchup
      </h1>

      {isConvexEnabled && matchupQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">Failed to load matchup</div>
          <div className="text-sm">{matchupQuery.error.message}</div>
        </div>
      ) : null}

      {isConvexEnabled && matchupQuery.isLoading ? (
        <div className="brutal-card p-4 mb-4">
          <div className="font-bold">Loading matchup...</div>
        </div>
      ) : null}

      {/* Score header */}
      <div className="brutal-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-lg font-black uppercase">{matchup.myTeam.name}</div>
            <div className="text-sm font-mono text-gray-500">{matchup.myTeam.record}</div>
          </div>
          <div className="text-center px-8">
            <div className="flex items-center gap-3">
              <span className={`text-5xl font-black ${myWins > theirWins ? 'text-brutal-green' : 'text-brutal-red'}`}>
                {myWins}
              </span>
              <span className="text-3xl font-bold text-gray-300">-</span>
              <span className={`text-5xl font-black ${theirWins > myWins ? 'text-brutal-green' : 'text-brutal-red'}`}>
                {theirWins}
              </span>
            </div>
            <div className="text-xs font-bold uppercase text-gray-400 mt-1">Categories</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-black uppercase">{matchup.opponent.name}</div>
            <div className="text-sm font-mono text-gray-500">{matchup.opponent.record}</div>
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {matchup.categories.map((cat) => (
          <div
            key={cat.name}
            className={`brutal-card p-4 ${cat.winning ? 'border-brutal-green' : 'border-brutal-red'}`}
            style={{ borderColor: cat.winning ? '#2ECC71' : '#E74C3C' }}
          >
            <div className="text-xs font-black uppercase text-gray-400 mb-2">
              {cat.name}
            </div>
            <div className="flex justify-between items-end">
              <div className={`text-xl font-black ${cat.winning ? 'text-brutal-green' : ''}`}>
                {cat.name === 'FG%' || cat.name === 'FT%'
                  ? (cat.mine * 100).toFixed(1) + '%'
                  : cat.mine}
              </div>
              <div className={`text-xl font-black ${!cat.winning ? 'text-brutal-red' : ''}`}>
                {cat.name === 'FG%' || cat.name === 'FT%'
                  ? (cat.theirs * 100).toFixed(1) + '%'
                  : cat.theirs}
              </div>
            </div>
            <div className="flex justify-between text-xs font-bold text-gray-400 mt-1">
              <span>ME</span>
              <span>OPP</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-gray-500 font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  )
}
