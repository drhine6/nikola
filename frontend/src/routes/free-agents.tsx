import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api, asNumber, convexArgs, formatAgoFromMs, isConvexEnabled } from '~/lib/convex-bridge'

export const Route = createFileRoute('/free-agents')({
  component: FreeAgents,
})

// Mock data — will be replaced by Convex useQuery(api.queries.getFreeAgents)
const mockFreeAgents = [
  { id: 'fa1', name: 'Malik Monk', position: 'SG', proTeam: 'SAC', stats: { ppg: 15.2, rpg: 2.8, apg: 4.1, spg: 0.8, bpg: 0.2, threepm: 2.4, fgPct: 0.462, ftPct: 0.882, topg: 1.6 }, trending: 'up' },
  { id: 'fa2', name: 'Naz Reid', position: 'PF', proTeam: 'MIN', stats: { ppg: 13.8, rpg: 6.2, apg: 1.5, spg: 0.6, bpg: 1.0, threepm: 1.4, fgPct: 0.495, ftPct: 0.798, topg: 1.2 }, trending: 'up' },
  { id: 'fa3', name: 'Buddy Hield', position: 'SG', proTeam: 'GSW', stats: { ppg: 12.4, rpg: 3.1, apg: 2.2, spg: 0.7, bpg: 0.1, threepm: 3.2, fgPct: 0.438, ftPct: 0.865, topg: 1.3 }, trending: 'neutral' },
  { id: 'fa4', name: 'Kyle Anderson', position: 'SF', proTeam: 'MIN', stats: { ppg: 8.5, rpg: 4.8, apg: 4.2, spg: 1.3, bpg: 0.5, threepm: 0.6, fgPct: 0.504, ftPct: 0.758, topg: 1.5 }, trending: 'up' },
  { id: 'fa5', name: 'Jalen Duren', position: 'C', proTeam: 'DET', stats: { ppg: 11.2, rpg: 9.8, apg: 1.8, spg: 0.5, bpg: 0.8, threepm: 0.0, fgPct: 0.612, ftPct: 0.645, topg: 2.1 }, trending: 'down' },
  { id: 'fa6', name: 'Brandon Ingram', position: 'SF', proTeam: 'NOP', stats: { ppg: 22.1, rpg: 5.1, apg: 5.6, spg: 0.7, bpg: 0.4, threepm: 1.5, fgPct: 0.475, ftPct: 0.855, topg: 2.8 }, trending: 'neutral' },
  { id: 'fa7', name: 'Amen Thompson', position: 'SG', proTeam: 'HOU', stats: { ppg: 12.8, rpg: 6.5, apg: 3.8, spg: 1.2, bpg: 0.6, threepm: 0.4, fgPct: 0.522, ftPct: 0.610, topg: 2.0 }, trending: 'up' },
  { id: 'fa8', name: 'Bogdan Bogdanovic', position: 'SG', proTeam: 'ATL', stats: { ppg: 13.5, rpg: 3.2, apg: 3.1, spg: 0.9, bpg: 0.2, threepm: 2.8, fgPct: 0.445, ftPct: 0.870, topg: 1.4 }, trending: 'down' },
]

function TrendBadge({ trend }: { trend: string }) {
  const config: Record<string, { label: string; color: string }> = {
    up: { label: 'HOT', color: 'bg-brutal-green text-brutal-white' },
    down: { label: 'COLD', color: 'bg-brutal-red text-brutal-white' },
    neutral: { label: 'STEADY', color: 'bg-gray-300 dark:bg-gray-600 text-brutal-black dark:text-brutal-white' },
  }
  const { label, color } = config[trend] || config.neutral
  return <span className={`brutal-tag ${color}`}>{label}</span>
}

function FreeAgents() {
  const freeAgentsQuery = useQuery(convexQuery(api.queries.getFreeAgents, convexArgs({ limit: 50 })))
  const syncLogQuery = useQuery(convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 })))

  const freeAgents = isConvexEnabled
    ? (freeAgentsQuery.data ?? []).map((row: any, idx: number) => {
        const season = row?.seasonAverage?.stats ?? {}
        const latest = row?.latestGame
        const latestScore = asNumber(latest?.fantasyScore, NaN)
        const seasonScore = asNumber(row?.seasonAverage?.fantasyScore, NaN)
        let trending: 'up' | 'down' | 'neutral' = 'neutral'
        if (Number.isFinite(latestScore) && Number.isFinite(seasonScore)) {
          if (latestScore > seasonScore + 3) trending = 'up'
          else if (latestScore < seasonScore - 3) trending = 'down'
        }

        return {
          id: row?.roster?._id ?? `${row?.roster?.espnPlayerId ?? idx}`,
          name: row?.player?.fullName ?? row?.roster?.playerName ?? `Player ${idx + 1}`,
          position:
            row?.player?.position ??
            (Array.isArray(row?.player?.positions) ? row.player.positions[0] : undefined) ??
            '—',
          proTeam: row?.player?.nbaTeamAbbr ?? '—',
          trending,
          stats: {
            ppg: asNumber(season.pts),
            rpg: asNumber(season.reb),
            apg: asNumber(season.ast),
            spg: asNumber(season.stl),
            bpg: asNumber(season.blk),
            threepm: asNumber(season.fg3m),
            fgPct: asNumber(season.fg_pct),
            ftPct: asNumber(season.ft_pct),
            topg: asNumber(season.turnover),
          },
        }
      })
    : mockFreeAgents

  const lastSyncedMs = (syncLogQuery.data?.[0] as any)?.finishedAt ?? (syncLogQuery.data?.[0] as any)?.startedAt
  const lastSyncedLabel = isConvexEnabled ? formatAgoFromMs(lastSyncedMs) : '2 minutes ago'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black uppercase">Free Agents</h1>
        <div className="brutal-card px-4 py-2">
          <span className="font-bold text-sm uppercase">
            {isConvexEnabled ? 'Free Agents Loaded: ' : 'Acquisitions Left: '}
          </span>
          <span className="text-xl font-black">{isConvexEnabled ? freeAgents.length : 5}</span>
          <span className="text-muted font-mono">{isConvexEnabled ? '' : '/7'}</span>
        </div>
      </div>

      {isConvexEnabled && freeAgentsQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">Failed to load free agents</div>
          <div className="text-sm">{freeAgentsQuery.error.message}</div>
        </div>
      ) : null}

      <div className="brutal-card overflow-x-auto">
        <table className="brutal-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>Trend</th>
              <th>PTS</th>
              <th>REB</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>3PM</th>
              <th>FG%</th>
              <th>FT%</th>
              <th>TO</th>
            </tr>
          </thead>
          <tbody>
            {isConvexEnabled && freeAgentsQuery.isLoading ? (
              <tr>
                <td colSpan={13} className="font-medium text-muted">
                  Loading free agents...
                </td>
              </tr>
            ) : null}
            {freeAgents.length === 0 && !(isConvexEnabled && freeAgentsQuery.isLoading) ? (
              <tr>
                <td colSpan={13} className="font-medium text-muted">
                  No free agent data yet. Run `syncLeague` to populate the player pool.
                </td>
              </tr>
            ) : null}
            {freeAgents.map((player) => (
              <tr key={player.id}>
                <td className="font-bold">{player.name}</td>
                <td>
                  <span className="brutal-tag bg-brutal-blue text-brutal-black">
                    {player.position}
                  </span>
                </td>
                <td className="font-mono text-sm">{player.proTeam}</td>
                <td><TrendBadge trend={player.trending} /></td>
                <td className="font-mono">{player.stats.ppg}</td>
                <td className="font-mono">{player.stats.rpg}</td>
                <td className="font-mono">{player.stats.apg}</td>
                <td className="font-mono">{player.stats.spg}</td>
                <td className="font-mono">{player.stats.bpg}</td>
                <td className="font-mono">{player.stats.threepm}</td>
                <td className="font-mono">{(player.stats.fgPct * 100).toFixed(1)}</td>
                <td className="font-mono">{(player.stats.ftPct * 100).toFixed(1)}</td>
                <td className="font-mono">{player.stats.topg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-muted font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  )
}
