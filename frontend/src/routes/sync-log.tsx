import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api, convexArgs, isConvexEnabled } from '~/lib/convex-bridge'

export const Route = createFileRoute('/sync-log')({
  component: SyncLog,
})

// Mock data — will be replaced by Convex useQuery(api.queries.getSyncLog)
const mockSyncLog = [
  { id: '1', timestamp: '2026-02-25T18:30:00Z', type: 'full', recordCounts: { teams: 10, players: 130, matchups: 5 }, status: 'success', error: null, durationMs: 2340 },
  { id: '2', timestamp: '2026-02-25T17:00:00Z', type: 'roster', recordCounts: { players: 13 }, status: 'success', error: null, durationMs: 890 },
  { id: '3', timestamp: '2026-02-25T15:30:00Z', type: 'scoreboard', recordCounts: { matchups: 5 }, status: 'success', error: null, durationMs: 650 },
  { id: '4', timestamp: '2026-02-25T14:00:00Z', type: 'full', recordCounts: { teams: 10, players: 130, matchups: 5 }, status: 'error', error: 'ESPN API timeout after 30s', durationMs: 30120 },
  { id: '5', timestamp: '2026-02-25T12:30:00Z', type: 'free_agents', recordCounts: { players: 50 }, status: 'success', error: null, durationMs: 1240 },
  { id: '6', timestamp: '2026-02-25T11:00:00Z', type: 'full', recordCounts: { teams: 10, players: 130, matchups: 5 }, status: 'success', error: null, durationMs: 2180 },
  { id: '7', timestamp: '2026-02-25T09:30:00Z', type: 'roster', recordCounts: { players: 13 }, status: 'success', error: null, durationMs: 780 },
  { id: '8', timestamp: '2026-02-25T08:00:00Z', type: 'full', recordCounts: { teams: 10, players: 130, matchups: 5 }, status: 'success', error: null, durationMs: 2450 },
]

function StatusBadge({ status }: { status: string }) {
  const isSuccess = status === 'success'
  return (
    <span
      className={`brutal-tag ${isSuccess ? 'bg-brutal-green text-brutal-white' : 'bg-brutal-red text-brutal-white'}`}
    >
      {status.toUpperCase()}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    full: 'bg-brutal-purple text-brutal-white',
    roster: 'bg-brutal-blue text-brutal-black',
    scoreboard: 'bg-brutal-yellow text-brutal-black',
    free_agents: 'bg-brutal-orange text-brutal-white',
  }
  return (
    <span className={`brutal-tag ${colors[type] || 'bg-gray-300'}`}>
      {type.replace('_', ' ')}
    </span>
  )
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SyncLog() {
  const syncLogQuery = useQuery(convexQuery(api.queries.getSyncLog, convexArgs({ limit: 50 })))
  const logs = isConvexEnabled
    ? (syncLogQuery.data ?? []).map((log: any) => ({
        id: log._id,
        timestamp: new Date(log.finishedAt ?? log.startedAt).toISOString(),
        type: log.syncType,
        recordCounts: log.recordCounts ?? {},
        status: log.status,
        error: log.error ?? null,
        durationMs:
          typeof log.finishedAt === 'number' && typeof log.startedAt === 'number'
            ? Math.max(0, log.finishedAt - log.startedAt)
            : 0,
      }))
    : mockSyncLog

  return (
    <div>
      <h1 className="text-3xl font-black uppercase mb-6">Sync Log</h1>

      {isConvexEnabled && syncLogQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">Failed to load sync log</div>
          <div className="text-sm">{syncLogQuery.error.message}</div>
        </div>
      ) : null}

      <div className="brutal-card overflow-x-auto">
        <table className="brutal-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Status</th>
              <th>Records</th>
              <th>Duration</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {isConvexEnabled && syncLogQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="font-medium text-gray-500">
                  Loading sync history...
                </td>
              </tr>
            ) : null}
            {logs.length === 0 && !(isConvexEnabled && syncLogQuery.isLoading) ? (
              <tr>
                <td colSpan={6} className="font-medium text-gray-500">
                  No sync runs logged yet. Trigger `syncSchedule` or `syncLeague`.
                </td>
              </tr>
            ) : null}
            {logs.map((log) => (
              <tr key={log.id}>
                <td>
                  <div className="font-bold">{formatTime(log.timestamp)}</div>
                  <div className="text-xs text-gray-400">{formatDate(log.timestamp)}</div>
                </td>
                <td><TypeBadge type={log.type} /></td>
                <td><StatusBadge status={log.status} /></td>
                <td className="font-mono text-sm">
                  {Object.entries(log.recordCounts)
                    .map(([k, v]) => `${v} ${k}`)
                    .join(', ')}
                </td>
                <td className="font-mono text-sm">
                  {log.durationMs >= 1000
                    ? (log.durationMs / 1000).toFixed(1) + 's'
                    : log.durationMs + 'ms'}
                </td>
                <td className="text-sm">
                  {log.error ? (
                    <span className="text-brutal-red font-medium">{log.error}</span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
