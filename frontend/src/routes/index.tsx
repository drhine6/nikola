import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api, asNumber, convexArgs, formatAgoFromMs, isConvexEnabled } from '~/lib/convex-bridge'

export const Route = createFileRoute('/')({
  component: MyTeam,
})

// Mock data — will be replaced by Convex useQuery(api.queries.getMyRoster)
const mockRoster = [
  { id: '1', name: 'Nikola Jokic', position: 'C', proTeam: 'DEN', injuryStatus: 'ACTIVE', stats: { ppg: 26.4, rpg: 12.3, apg: 9.0, spg: 1.4, bpg: 0.9, threepm: 1.1, fgPct: 0.583, ftPct: 0.822, topg: 3.2 } },
  { id: '2', name: 'Shai Gilgeous-Alexander', position: 'PG', proTeam: 'OKC', injuryStatus: 'ACTIVE', stats: { ppg: 31.2, rpg: 5.5, apg: 6.1, spg: 2.0, bpg: 0.9, threepm: 2.3, fgPct: 0.535, ftPct: 0.874, topg: 2.8 } },
  { id: '3', name: 'Jayson Tatum', position: 'SF', proTeam: 'BOS', injuryStatus: 'ACTIVE', stats: { ppg: 27.0, rpg: 8.1, apg: 4.6, spg: 1.0, bpg: 0.6, threepm: 3.1, fgPct: 0.471, ftPct: 0.853, topg: 2.5 } },
  { id: '4', name: 'Tyrese Haliburton', position: 'PG', proTeam: 'IND', injuryStatus: 'DAY_TO_DAY', stats: { ppg: 18.5, rpg: 3.7, apg: 8.8, spg: 1.2, bpg: 0.3, threepm: 2.5, fgPct: 0.442, ftPct: 0.855, topg: 2.1 } },
  { id: '5', name: 'Scottie Barnes', position: 'PF', proTeam: 'TOR', injuryStatus: 'ACTIVE', stats: { ppg: 20.6, rpg: 8.2, apg: 6.8, spg: 1.3, bpg: 1.1, threepm: 1.0, fgPct: 0.478, ftPct: 0.745, topg: 2.9 } },
  { id: '6', name: 'Domantas Sabonis', position: 'C', proTeam: 'SAC', injuryStatus: 'ACTIVE', stats: { ppg: 19.4, rpg: 13.8, apg: 6.2, spg: 0.8, bpg: 0.5, threepm: 0.5, fgPct: 0.571, ftPct: 0.723, topg: 3.0 } },
  { id: '7', name: 'Chet Holmgren', position: 'PF', proTeam: 'OKC', injuryStatus: 'OUT', stats: { ppg: 16.5, rpg: 7.9, apg: 2.4, spg: 0.8, bpg: 2.6, threepm: 1.6, fgPct: 0.528, ftPct: 0.795, topg: 1.7 } },
  { id: '8', name: 'Dejounte Murray', position: 'SG', proTeam: 'NOP', injuryStatus: 'ACTIVE', stats: { ppg: 14.8, rpg: 4.3, apg: 5.8, spg: 1.5, bpg: 0.4, threepm: 1.2, fgPct: 0.445, ftPct: 0.810, topg: 2.0 } },
  { id: '9', name: 'Jalen Williams', position: 'SG', proTeam: 'OKC', injuryStatus: 'ACTIVE', stats: { ppg: 21.3, rpg: 5.6, apg: 5.1, spg: 1.4, bpg: 0.7, threepm: 1.8, fgPct: 0.481, ftPct: 0.838, topg: 1.9 } },
  { id: '10', name: 'Alperen Sengun', position: 'C', proTeam: 'HOU', injuryStatus: 'ACTIVE', stats: { ppg: 19.0, rpg: 10.4, apg: 5.0, spg: 1.0, bpg: 0.7, threepm: 0.3, fgPct: 0.540, ftPct: 0.718, topg: 2.8 } },
]

function InjuryBadge({ status }: { status: string }) {
  if (status === 'ACTIVE') return null
  const colors: Record<string, string> = {
    DAY_TO_DAY: 'bg-brutal-yellow text-brutal-black',
    OUT: 'bg-brutal-red text-brutal-white',
    SUSPENSION: 'bg-brutal-orange text-brutal-white',
  }
  return (
    <span className={`brutal-tag ${colors[status] || 'bg-brutal-gray'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

function MyTeam() {
  const rosterQuery = useQuery(convexQuery(api.queries.getMyRoster, convexArgs({})))
  const syncLogQuery = useQuery(convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 })))

  const roster = isConvexEnabled
    ? (rosterQuery.data ?? []).map((row: any, idx: number) => {
        const stats = row?.stats?.seasonAverage?.stats ?? row?.stats?.latestGame?.stats ?? {}
        return {
          id: row?.roster?._id ?? `${row?.roster?.espnPlayerId ?? idx}`,
          name: row?.player?.fullName ?? row?.roster?.playerName ?? `Player ${idx + 1}`,
          position:
            row?.player?.position ??
            (Array.isArray(row?.player?.positions) ? row.player.positions[0] : undefined) ??
            '—',
          proTeam: row?.player?.nbaTeamAbbr ?? '—',
          injuryStatus: row?.roster?.injuryStatus ?? row?.player?.injuryStatus ?? 'ACTIVE',
          stats: {
            ppg: asNumber(stats.pts),
            rpg: asNumber(stats.reb),
            apg: asNumber(stats.ast),
            spg: asNumber(stats.stl),
            bpg: asNumber(stats.blk),
            threepm: asNumber(stats.fg3m),
            fgPct: asNumber(stats.fg_pct),
            ftPct: asNumber(stats.ft_pct),
            topg: asNumber(stats.turnover),
          },
        }
      })
    : mockRoster

  const rosterCount = roster.length
  const lastSyncedMs = (syncLogQuery.data?.[0] as any)?.finishedAt ?? (syncLogQuery.data?.[0] as any)?.startedAt
  const lastSyncedLabel = isConvexEnabled ? formatAgoFromMs(lastSyncedMs) : '2 minutes ago'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-black uppercase">My Team</h1>
        <div className="brutal-card px-4 py-2 flex items-center gap-3">
          <span className="font-bold text-sm uppercase">
            {isConvexEnabled ? 'Rostered Players' : 'Games This Week'}
          </span>
          <span className="text-2xl font-black">
            {isConvexEnabled ? (
              <span>{rosterCount}</span>
            ) : (
              <>
                <span className={18 > 20 ? 'text-brutal-orange' : ''}>18</span>
                <span className="text-gray-400">/25</span>
              </>
            )}
          </span>
        </div>
      </div>

      {isConvexEnabled && rosterQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">Failed to load roster</div>
          <div className="text-sm">{rosterQuery.error.message}</div>
        </div>
      ) : null}

      <div className="brutal-card overflow-x-auto">
        <table className="brutal-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>Status</th>
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
            {isConvexEnabled && rosterQuery.isLoading ? (
              <tr>
                <td colSpan={13} className="font-medium text-gray-500">
                  Loading roster...
                </td>
              </tr>
            ) : null}
            {roster.length === 0 && !(isConvexEnabled && rosterQuery.isLoading) ? (
              <tr>
                <td colSpan={13} className="font-medium text-gray-500">
                  No roster data yet. Run `syncLeague` in Convex, then refresh.
                </td>
              </tr>
            ) : null}
            {roster.map((player) => (
              <tr key={player.id}>
                <td className="font-bold">{player.name}</td>
                <td>
                  <span className="brutal-tag bg-brutal-blue text-brutal-black">
                    {player.position}
                  </span>
                </td>
                <td className="font-mono text-sm">{player.proTeam}</td>
                <td><InjuryBadge status={player.injuryStatus} /></td>
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

      <div className="mt-4 text-sm text-gray-500 font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  )
}
