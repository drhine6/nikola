import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leagues: defineTable({
    leagueKey: v.string(),
    espnLeagueId: v.string(),
    season: v.number(),
    name: v.optional(v.string()),
    currentScoringPeriodId: v.optional(v.number()),
    currentMatchupPeriodId: v.optional(v.number()),
    scoringSettings: v.optional(v.any()),
    config: v.optional(v.any()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_leagueKey", ["leagueKey"])
    .index("by_espnLeagueId_season", ["espnLeagueId", "season"]),

  teams: defineTable({
    leagueKey: v.string(),
    espnTeamId: v.number(),
    name: v.string(),
    abbrev: v.optional(v.string()),
    ownerDisplayNames: v.array(v.string()),
    standingRank: v.optional(v.number()),
    wins: v.optional(v.number()),
    losses: v.optional(v.number()),
    ties: v.optional(v.number()),
    pointsFor: v.optional(v.number()),
    pointsAgainst: v.optional(v.number()),
    record: v.optional(v.any()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_leagueKey", ["leagueKey"])
    .index("by_leagueKey_teamId", ["leagueKey", "espnTeamId"])
    .index("by_leagueKey_rank", ["leagueKey", "standingRank"]),

  rosters: defineTable({
    assignmentKey: v.string(),
    leagueKey: v.string(),
    espnPlayerId: v.number(),
    assignmentType: v.union(v.literal("team"), v.literal("free_agent")),
    espnTeamId: v.optional(v.number()),
    playerName: v.optional(v.string()),
    lineupSlotId: v.optional(v.number()),
    lineupSlotName: v.optional(v.string()),
    injuryStatus: v.optional(v.string()),
    acquisitionType: v.optional(v.string()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_assignmentKey", ["assignmentKey"])
    .index("by_leagueKey_assignmentType", ["leagueKey", "assignmentType"])
    .index("by_leagueKey_teamId", ["leagueKey", "espnTeamId"])
    .index("by_leagueKey_playerId", ["leagueKey", "espnPlayerId"]),

  matchups: defineTable({
    matchupKey: v.string(),
    leagueKey: v.string(),
    matchupPeriodId: v.number(),
    scoringPeriodId: v.optional(v.number()),
    homeTeamId: v.number(),
    awayTeamId: v.number(),
    homeScore: v.optional(v.number()),
    awayScore: v.optional(v.number()),
    winner: v.optional(v.string()),
    categories: v.optional(v.any()),
    isPlayoff: v.optional(v.boolean()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_matchupKey", ["matchupKey"])
    .index("by_leagueKey", ["leagueKey"])
    .index("by_leagueKey_period", ["leagueKey", "matchupPeriodId"]),

  players: defineTable({
    playerKey: v.string(),
    espnPlayerId: v.optional(v.number()),
    balldontliePlayerId: v.optional(v.number()),
    fullName: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    position: v.optional(v.string()),
    positions: v.optional(v.array(v.string())),
    nbaTeamAbbr: v.optional(v.string()),
    injuryStatus: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_playerKey", ["playerKey"])
    .index("by_espnPlayerId", ["espnPlayerId"])
    .index("by_balldontliePlayerId", ["balldontliePlayerId"]),

  playerStats: defineTable({
    statKey: v.string(),
    playerKey: v.string(),
    espnPlayerId: v.optional(v.number()),
    balldontliePlayerId: v.optional(v.number()),
    statType: v.union(v.literal("game"), v.literal("season_average")),
    gameId: v.optional(v.string()),
    season: v.optional(v.number()),
    gameDate: v.optional(v.string()),
    fantasyScore: v.optional(v.number()),
    stats: v.any(),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_statKey", ["statKey"])
    .index("by_playerKey_statType", ["playerKey", "statType"])
    .index("by_gameId", ["gameId"])
    .index("by_gameDate", ["gameDate"]),

  games: defineTable({
    externalGameId: v.string(),
    season: v.optional(v.number()),
    gameDate: v.string(),
    startsAt: v.optional(v.string()),
    status: v.string(),
    isActive: v.boolean(),
    homeTeamAbbr: v.optional(v.string()),
    awayTeamAbbr: v.optional(v.string()),
    homeScore: v.optional(v.number()),
    awayScore: v.optional(v.number()),
    raw: v.optional(v.any()),
    updatedAt: v.number(),
  })
    .index("by_externalGameId", ["externalGameId"])
    .index("by_gameDate", ["gameDate"])
    .index("by_isActive", ["isActive"]),

  syncLog: defineTable({
    syncType: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
      v.literal("skipped"),
    ),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    recordCounts: v.optional(v.any()),
    error: v.optional(v.string()),
    meta: v.optional(v.any()),
  })
    .index("by_syncType_startedAt", ["syncType", "startedAt"])
    .index("by_startedAt", ["startedAt"]),
});
