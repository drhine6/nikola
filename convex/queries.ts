import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

function envLeagueKey() {
  const leagueId = process.env.ESPN_LEAGUE_ID ?? process.env.LEAGUE_ID;
  const season = process.env.ESPN_SEASON ?? process.env.LEAGUE_YEAR;
  if (!leagueId || !season) return undefined;
  return `${leagueId}:${Number(season)}`;
}

function scoreForSort(item: any) {
  if (typeof item?.seasonAverage?.fantasyScore === "number") return item.seasonAverage.fantasyScore;
  if (typeof item?.latestGame?.fantasyScore === "number") return item.latestGame.fantasyScore;
  return -Infinity;
}

function normalizeName(name?: string | null) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

async function resolveLeagueKey(ctx: any, requestedLeagueKey?: string) {
  if (requestedLeagueKey) return requestedLeagueKey;
  const envKey = envLeagueKey();
  if (envKey) return envKey;
  const latest = await ctx.db.query("leagues").order("desc").first();
  return latest?.leagueKey;
}

async function getLatestStatForPlayer(ctx: any, playerKey: string, statType: "game" | "season_average") {
  const rows = await ctx.db
    .query("playerStats")
    .withIndex("by_playerKey_statType", (q: any) => q.eq("playerKey", playerKey).eq("statType", statType))
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

async function getPlayerByEspnId(ctx: any, espnPlayerId: number) {
  return await ctx.db
    .query("players")
    .withIndex("by_espnPlayerId", (q: any) => q.eq("espnPlayerId", espnPlayerId))
    .first();
}

async function resolveMyTeamId(ctx: any, leagueKey: string) {
  const envTeamId = process.env.ESPN_MY_TEAM_ID;
  if (envTeamId && !Number.isNaN(Number(envTeamId))) return Number(envTeamId);
  const team = await ctx.db
    .query("teams")
    .withIndex("by_leagueKey", (q: any) => q.eq("leagueKey", leagueKey))
    .order("asc")
    .first();
  return team?.espnTeamId;
}

export const getTrackedPlayersForSync = internalQuery({
  args: {
    leagueKey: v.string(),
  },
  handler: async (ctx, args) => {
    const rosterRows = await ctx.db
      .query("rosters")
      .withIndex("by_leagueKey_assignmentType", (q) =>
        q.eq("leagueKey", args.leagueKey).eq("assignmentType", "team"),
      )
      .collect();

    const out = [];
    for (const roster of rosterRows) {
      const player = await getPlayerByEspnId(ctx, roster.espnPlayerId);
      out.push({
        espnPlayerId: roster.espnPlayerId,
        balldontliePlayerId: player?.balldontliePlayerId ?? null,
        playerKey: player?.playerKey ?? `espn:${roster.espnPlayerId}`,
      });
    }
    return out;
  },
});

export const getLeagueConfig = query({
  args: {
    leagueKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const leagueKey = await resolveLeagueKey(ctx, args.leagueKey);
    if (!leagueKey) return null;
    return await ctx.db
      .query("leagues")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .unique();
  },
});

export const getStandings = query({
  args: {
    leagueKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const leagueKey = await resolveLeagueKey(ctx, args.leagueKey);
    if (!leagueKey) return [];
    const teams = await ctx.db
      .query("teams")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .collect();
    return teams.sort((a, b) => (a.standingRank ?? 999) - (b.standingRank ?? 999));
  },
});

export const getCurrentMatchup = query({
  args: {
    leagueKey: v.optional(v.string()),
    myTeamId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leagueKey = await resolveLeagueKey(ctx, args.leagueKey);
    if (!leagueKey) return null;
    const myTeamId = args.myTeamId ?? (await resolveMyTeamId(ctx, leagueKey));
    if (myTeamId == null) return null;

    const allMatchups = await ctx.db
      .query("matchups")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .collect();
    const relevant = allMatchups.filter((m) => m.homeTeamId === myTeamId || m.awayTeamId === myTeamId);
    if (relevant.length === 0) return null;

    relevant.sort((a, b) => (b.matchupPeriodId ?? 0) - (a.matchupPeriodId ?? 0));
    const matchup = relevant[0];

    const [homeTeam, awayTeam] = await Promise.all([
      ctx.db
        .query("teams")
        .withIndex("by_leagueKey_teamId", (q: any) => q.eq("leagueKey", leagueKey).eq("espnTeamId", matchup.homeTeamId))
        .unique(),
      ctx.db
        .query("teams")
        .withIndex("by_leagueKey_teamId", (q: any) => q.eq("leagueKey", leagueKey).eq("espnTeamId", matchup.awayTeamId))
        .unique(),
    ]);

    return {
      ...matchup,
      homeTeam,
      awayTeam,
      scoringBreakdown: matchup.categories ?? null,
    };
  },
});

export const getMyRoster = query({
  args: {
    leagueKey: v.optional(v.string()),
    myTeamId: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leagueKey = await resolveLeagueKey(ctx, args.leagueKey);
    if (!leagueKey) return [];
    const myTeamId = args.myTeamId ?? (await resolveMyTeamId(ctx, leagueKey));
    if (myTeamId == null) return [];

    const rosterRows = await ctx.db
      .query("rosters")
      .withIndex("by_leagueKey_teamId", (q) => q.eq("leagueKey", leagueKey).eq("espnTeamId", myTeamId))
      .collect();

    const allPlayers = await ctx.db.query("players").collect();
    const bdlPlayersByName = new Map<string, any>();
    for (const p of allPlayers) {
      if (!String(p.playerKey ?? "").startsWith("bdl:")) continue;
      const key = normalizeName(p.fullName);
      if (key && !bdlPlayersByName.has(key)) bdlPlayersByName.set(key, p);
    }

    const result = [];
    for (const roster of rosterRows.filter((r) => r.assignmentType === "team")) {
      const player = await getPlayerByEspnId(ctx, roster.espnPlayerId);
      const bdlPlayer =
        player && String(player.playerKey).startsWith("bdl:")
          ? player
          : bdlPlayersByName.get(normalizeName(player?.fullName ?? roster.playerName));
      const espnPlayerKey = `espn:${roster.espnPlayerId}`;
      const seasonAverage =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "season_average")) ??
        (player?.playerKey ? await getLatestStatForPlayer(ctx, player.playerKey, "season_average") : null) ??
        (bdlPlayer?.playerKey ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "season_average") : null);
      const latestGame =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "game")) ??
        (player?.playerKey ? await getLatestStatForPlayer(ctx, player.playerKey, "game") : null) ??
        (bdlPlayer?.playerKey ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "game") : null);

      result.push({
        roster,
        player: player ?? bdlPlayer ?? null,
        stats: {
          seasonAverage,
          latestGame,
        },
      });
    }

    return result.sort((a, b) => String(a.roster.playerName ?? "").localeCompare(String(b.roster.playerName ?? "")));
  },
});

export const getFreeAgents = query({
  args: {
    leagueKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const leagueKey = await resolveLeagueKey(ctx, args.leagueKey);
    if (!leagueKey) return [];
    const limit = args.limit ?? 50;

    const freeAgents = await ctx.db
      .query("rosters")
      .withIndex("by_leagueKey_assignmentType", (q) =>
        q.eq("leagueKey", leagueKey).eq("assignmentType", "free_agent"),
      )
      .collect();

    const allPlayers = await ctx.db.query("players").collect();
    const bdlPlayersByName = new Map<string, any>();
    for (const p of allPlayers) {
      if (!String(p.playerKey ?? "").startsWith("bdl:")) continue;
      const key = normalizeName(p.fullName);
      if (key && !bdlPlayersByName.has(key)) bdlPlayersByName.set(key, p);
    }

    const hydrated = [];
    for (const roster of freeAgents) {
      const player = await getPlayerByEspnId(ctx, roster.espnPlayerId);
      const bdlPlayer =
        player && String(player.playerKey).startsWith("bdl:")
          ? player
          : bdlPlayersByName.get(normalizeName(player?.fullName ?? roster.playerName));
      const espnPlayerKey = `espn:${roster.espnPlayerId}`;
      const seasonAverage =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "season_average")) ??
        (player?.playerKey ? await getLatestStatForPlayer(ctx, player.playerKey, "season_average") : null) ??
        (bdlPlayer?.playerKey ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "season_average") : null);
      const latestGame =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "game")) ??
        (player?.playerKey ? await getLatestStatForPlayer(ctx, player.playerKey, "game") : null) ??
        (bdlPlayer?.playerKey ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "game") : null);
      hydrated.push({ roster, player: player ?? bdlPlayer ?? null, seasonAverage, latestGame });
    }

    hydrated.sort((a, b) => scoreForSort(b) - scoreForSort(a));
    return hydrated.slice(0, limit);
  },
});

export const getSyncLog = query({
  args: {
    limit: v.optional(v.number()),
    syncType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    if (args.syncType) {
      const rows = await ctx.db
        .query("syncLog")
        .withIndex("by_syncType_startedAt", (q) => q.eq("syncType", args.syncType!))
        .order("desc")
        .take(limit);
      return rows;
    }
    return await ctx.db.query("syncLog").withIndex("by_startedAt").order("desc").take(limit);
  },
});
