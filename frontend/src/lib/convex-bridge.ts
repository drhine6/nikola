export { api } from '../../../convex/_generated/api'

export const isConvexEnabled = Boolean((import.meta as any).env.VITE_CONVEX_URL)

export function convexArgs<T extends Record<string, unknown>>(args: T): T | 'skip' {
  return isConvexEnabled ? args : 'skip'
}

export function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return fallback
}

export function formatAgoFromMs(timestampMs?: number | null): string {
  if (!timestampMs) return 'never'
  const diffMs = Math.max(0, Date.now() - timestampMs)
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
