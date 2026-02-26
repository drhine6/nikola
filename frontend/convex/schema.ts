import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  teams: defineTable({
    espnId: v.number(),
    name: v.string(),
    wins: v.number(),
    losses: v.number(),
    ties: v.number(),
    pointsFor: v.number(),
    pointsAgainst: v.number(),
    acquisitions: v.number(),
    trades: v.number(),
    isMyTeam: v.boolean(),
  }).index('by_espnId', ['espnId']),

  players: defineTable({
    espnId: v.number(),
    name: v.string(),
    position: v.string(),
    proTeam: v.string(),
    injuryStatus: v.string(),
    teamId: v.optional(v.id('teams')),
    isFreeAgent: v.boolean(),
    stats: v.object({
      ppg: v.number(),
      rpg: v.number(),
      apg: v.number(),
      spg: v.number(),
      bpg: v.number(),
      threepm: v.number(),
      fgPct: v.number(),
      ftPct: v.number(),
      topg: v.number(),
    }),
  }).index('by_espnId', ['espnId']),

  matchups: defineTable({
    week: v.number(),
    homeTeamId: v.id('teams'),
    awayTeamId: v.id('teams'),
    homeScore: v.object({
      pts: v.number(),
      reb: v.number(),
      ast: v.number(),
      stl: v.number(),
      blk: v.number(),
      threepm: v.number(),
      fgPct: v.number(),
      ftPct: v.number(),
      to: v.number(),
    }),
    awayScore: v.object({
      pts: v.number(),
      reb: v.number(),
      ast: v.number(),
      stl: v.number(),
      blk: v.number(),
      threepm: v.number(),
      fgPct: v.number(),
      ftPct: v.number(),
      to: v.number(),
    }),
  }).index('by_week', ['week']),

  syncLog: defineTable({
    timestamp: v.number(),
    type: v.string(),
    recordCounts: v.any(),
    status: v.string(),
    error: v.optional(v.string()),
    durationMs: v.number(),
  }),
})
