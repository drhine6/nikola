import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

function cleanDoc(value: any): any {
  if (Array.isArray(value)) {
    return value.map(cleanDoc);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanDoc(v)]),
    );
  }
  return value;
}

async function patchOrInsertByIndex(
  ctx: any,
  table: any,
  index: string,
  fields: any[],
  matchValues: any[],
  value: Record<string, unknown>,
) {
  let q = ctx.db.query(table).withIndex(index, (qq: any) => {
    let chain = qq;
    fields.forEach((field, i) => {
      chain = chain.eq(field, matchValues[i]);
    });
    return chain;
  });

  const cleanedValue = cleanDoc(value);
  const existing = await q.unique();
  if (existing) {
    await ctx.db.patch(existing._id, cleanedValue);
    return { op: "updated" as const, id: existing._id };
  }
  const inserted = await ctx.db.insert(table, cleanedValue);
  return { op: "inserted" as const, id: inserted };
}

export const beginSyncLog = internalMutation({
  args: {
    syncType: v.string(),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("syncLog", cleanDoc({
      syncType: args.syncType,
      status: "running",
      startedAt: Date.now(),
      meta: args.meta,
    }));
  },
});

export const finishSyncLog = internalMutation({
  args: {
    logId: v.id("syncLog"),
    status: v.union(
      v.literal("success"),
      v.literal("error"),
      v.literal("skipped"),
    ),
    recordCounts: v.optional(v.any()),
    error: v.optional(v.string()),
    meta: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.logId, cleanDoc({
      status: args.status,
      recordCounts: args.recordCounts,
      error: args.error,
      meta: args.meta,
      finishedAt: Date.now(),
    }));
  },
});

export const upsertLeague = internalMutation({
  args: {
    league: v.object({
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
    }),
  },
  handler: async (ctx, args) => {
    return await patchOrInsertByIndex(
      ctx,
      "leagues",
      "by_leagueKey",
      ["leagueKey"],
      [args.league.leagueKey],
      args.league,
    );
  },
});

export const upsertTeams = internalMutation({
  args: {
    teams: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const team of args.teams) {
      const result = await patchOrInsertByIndex(
        ctx,
        "teams",
        "by_leagueKey_teamId",
        ["leagueKey", "espnTeamId"],
        [team.leagueKey, team.espnTeamId],
        team,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.teams.length };
  },
});

export const upsertRosters = internalMutation({
  args: {
    rows: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const result = await patchOrInsertByIndex(
        ctx,
        "rosters",
        "by_assignmentKey",
        ["assignmentKey"],
        [row.assignmentKey],
        row,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.rows.length };
  },
});

export const upsertMatchups = internalMutation({
  args: {
    rows: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const result = await patchOrInsertByIndex(
        ctx,
        "matchups",
        "by_matchupKey",
        ["matchupKey"],
        [row.matchupKey],
        row,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.rows.length };
  },
});

export const upsertPlayers = internalMutation({
  args: {
    rows: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const result = await patchOrInsertByIndex(
        ctx,
        "players",
        "by_playerKey",
        ["playerKey"],
        [row.playerKey],
        row,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.rows.length };
  },
});

export const upsertPlayerStats = internalMutation({
  args: {
    rows: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const result = await patchOrInsertByIndex(
        ctx,
        "playerStats",
        "by_statKey",
        ["statKey"],
        [row.statKey],
        row,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.rows.length };
  },
});

export const upsertGames = internalMutation({
  args: {
    rows: v.array(
      v.object({
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
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;
    for (const row of args.rows) {
      const result = await patchOrInsertByIndex(
        ctx,
        "games",
        "by_externalGameId",
        ["externalGameId"],
        [row.externalGameId],
        row,
      );
      if (result.op === "inserted") inserted++;
      else updated++;
    }
    return { inserted, updated, total: args.rows.length };
  },
});
