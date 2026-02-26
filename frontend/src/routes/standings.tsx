import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api, asNumber, convexArgs, formatAgoFromMs, isConvexEnabled } from '~/lib/convex-bridge'

export const Route = createFileRoute('/standings')({
  component: Standings,
})

// Mock data — will be replaced by Convex useQuery(api.queries.getStandings)
const mockStandings = [
  { rank: 1, teamName: "David's Team", wins: 12, losses: 5, ties: 0, pointsFor: 1245.8, pointsAgainst: 1102.3, streak: 'W3' },
  { rank: 2, teamName: 'Hoops Dynasty', wins: 11, losses: 6, ties: 0, pointsFor: 1198.2, pointsAgainst: 1087.5, streak: 'W1' },
  { rank: 3, teamName: "Mike's Squad", wins: 10, losses: 7, ties: 0, pointsFor: 1156.4, pointsAgainst: 1098.7, streak: 'L2' },
  { rank: 4, teamName: 'Splash Brothers', wins: 10, losses: 7, ties: 0, pointsFor: 1134.9, pointsAgainst: 1102.1, streak: 'W2' },
  { rank: 5, teamName: 'Bucket Brigade', wins: 9, losses: 8, ties: 0, pointsFor: 1112.6, pointsAgainst: 1118.3, streak: 'L1' },
  { rank: 6, teamName: 'Triple Doubles', wins: 9, losses: 8, ties: 0, pointsFor: 1098.2, pointsAgainst: 1105.8, streak: 'W1' },
  { rank: 7, teamName: 'Rim Protectors', wins: 8, losses: 9, ties: 0, pointsFor: 1075.4, pointsAgainst: 1098.9, streak: 'L3' },
  { rank: 8, teamName: 'Free Throw Line', wins: 7, losses: 10, ties: 0, pointsFor: 1056.8, pointsAgainst: 1132.4, streak: 'L1' },
  { rank: 9, teamName: 'Ankle Breakers', wins: 6, losses: 11, ties: 0, pointsFor: 1023.5, pointsAgainst: 1145.2, streak: 'W1' },
  { rank: 10, teamName: 'Last Pick Lenny', wins: 4, losses: 13, ties: 0, pointsFor: 945.2, pointsAgainst: 1198.6, streak: 'L5' },
]

function Standings() {
  const standingsQuery = useQuery(convexQuery(api.queries.getStandings, convexArgs({})))
  const syncLogQuery = useQuery(convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 })))

  const standings = isConvexEnabled
    ? (standingsQuery.data ?? []).map((team: any, idx: number) => ({
        rank: team.standingRank ?? idx + 1,
        teamName: team.name ?? `Team ${team.espnTeamId ?? idx + 1}`,
        wins: asNumber(team.wins),
        losses: asNumber(team.losses),
        ties: asNumber(team.ties),
        pointsFor: asNumber(team.pointsFor),
        pointsAgainst: asNumber(team.pointsAgainst),
        streak: '—',
        isMyTeam: false,
      }))
    : mockStandings.map((team) => ({ ...team, isMyTeam: team.teamName === "David's Team" }))

  const lastSyncedMs = (syncLogQuery.data?.[0] as any)?.finishedAt ?? (syncLogQuery.data?.[0] as any)?.startedAt
  const lastSyncedLabel = isConvexEnabled ? formatAgoFromMs(lastSyncedMs) : '2 minutes ago'

  return (
    <div>
      <h1 className="text-3xl font-black uppercase mb-6">League Standings</h1>

      {isConvexEnabled && standingsQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">Failed to load standings</div>
          <div className="text-sm">{standingsQuery.error.message}</div>
        </div>
      ) : null}

      <div className="brutal-card overflow-x-auto">
        <table className="brutal-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th>W</th>
              <th>L</th>
              <th>T</th>
              <th>Win%</th>
              <th>PF</th>
              <th>PA</th>
              <th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {isConvexEnabled && standingsQuery.isLoading ? (
              <tr>
                <td colSpan={9} className="font-medium text-gray-500">
                  Loading standings...
                </td>
              </tr>
            ) : null}
            {standings.length === 0 && !(isConvexEnabled && standingsQuery.isLoading) ? (
              <tr>
                <td colSpan={9} className="font-medium text-gray-500">
                  No standings yet. Run `syncLeague` in Convex.
                </td>
              </tr>
            ) : null}
            {standings.map((team) => {
              const totalGames = team.wins + team.losses + team.ties
              const winPct = totalGames > 0 ? (team.wins / totalGames).toFixed(3) : '.000'
              const isMyTeam = Boolean((team as any).isMyTeam)
              const streakColor =
                typeof team.streak === 'string' && team.streak.startsWith('W')
                  ? 'text-brutal-green'
                  : typeof team.streak === 'string' && team.streak.startsWith('L')
                    ? 'text-brutal-red'
                    : ''

              return (
                <tr
                  key={team.rank}
                  className={isMyTeam ? 'bg-brutal-yellow/20' : ''}
                >
                  <td className="font-black text-lg">{team.rank}</td>
                  <td className={`font-bold ${isMyTeam ? 'text-brutal-purple' : ''}`}>
                    {team.teamName}
                    {isMyTeam && (
                      <span className="brutal-tag bg-brutal-purple text-brutal-white ml-2">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="font-mono font-bold">{team.wins}</td>
                  <td className="font-mono">{team.losses}</td>
                  <td className="font-mono">{team.ties}</td>
                  <td className="font-mono">{winPct}</td>
                  <td className="font-mono">{team.pointsFor.toFixed(1)}</td>
                  <td className="font-mono">{team.pointsAgainst.toFixed(1)}</td>
                  <td className={`font-bold ${streakColor}`}>{team.streak}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-gray-500 font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  )
}
