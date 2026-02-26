import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalQuery } from "./_generated/server";

type AnyRecord = Record<string, any>;
type LeagueRow = {
  leagueKey: string;
  espnLeagueId: string;
  season: number;
  updatedAt: number;
  name?: string;
  currentScoringPeriodId?: number;
  currentMatchupPeriodId?: number;
  scoringSettings?: any;
  config?: any;
  raw?: any;
};
type TeamRow = {
  leagueKey: string;
  espnTeamId: number;
  name: string;
  ownerDisplayNames: string[];
  updatedAt: number;
  abbrev?: string;
  standingRank?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  record?: any;
  raw?: any;
};
type RosterRow = {
  assignmentKey: string;
  leagueKey: string;
  espnPlayerId: number;
  assignmentType: "team" | "free_agent";
  updatedAt: number;
  espnTeamId?: number;
  playerName?: string;
  lineupSlotId?: number;
  lineupSlotName?: string;
  injuryStatus?: string;
  acquisitionType?: string;
  raw?: any;
};
type MatchupRow = {
  matchupKey: string;
  leagueKey: string;
  matchupPeriodId: number;
  homeTeamId: number;
  awayTeamId: number;
  updatedAt: number;
  scoringPeriodId?: number;
  homeScore?: number;
  awayScore?: number;
  winner?: string;
  categories?: any;
  isPlayoff?: boolean;
  raw?: any;
};
type PlayerRow = {
  playerKey: string;
  fullName: string;
  updatedAt: number;
  espnPlayerId?: number;
  balldontliePlayerId?: number;
  firstName?: string;
  lastName?: string;
  position?: string;
  positions?: string[];
  nbaTeamAbbr?: string;
  injuryStatus?: string;
  isActive?: boolean;
  raw?: any;
};

type PlayerStatRow = {
  statKey: string;
  playerKey: string;
  statType: "game" | "season_average";
  stats: any;
  updatedAt: number;
  espnPlayerId?: number;
  balldontliePlayerId?: number;
  gameId?: string;
  season?: number;
  gameDate?: string;
  fantasyScore?: number;
  raw?: any;
};

type GameRow = {
  externalGameId: string;
  gameDate: string;
  status: string;
  isActive: boolean;
  updatedAt: number;
  season?: number;
  startsAt?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeScore?: number;
  awayScore?: number;
  raw?: any;
};

function envLeagueId() {
  return process.env.ESPN_LEAGUE_ID ?? process.env.LEAGUE_ID ?? "";
}

function envSeason() {
  const raw = process.env.ESPN_SEASON ?? process.env.LEAGUE_YEAR ?? `${new Date().getFullYear()}`;
  return Number(raw);
}

function leagueKeyFromEnv() {
  return `${envLeagueId()}:${envSeason()}`;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  return undefined;
}

function cleanValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => cleanValue(v)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanValue(v)]),
    ) as T;
  }
  return value;
}

function computeFantasyScore(stats: AnyRecord) {
  const pts = toNumber(stats.pts) ?? 0;
  const reb = toNumber(stats.reb) ?? 0;
  const ast = toNumber(stats.ast) ?? 0;
  const stl = toNumber(stats.stl) ?? 0;
  const blk = toNumber(stats.blk) ?? 0;
  const fg3m = toNumber(stats.fg3m) ?? toNumber(stats.fg3_pct) ?? 0;
  const tov = toNumber(stats.turnover) ?? toNumber(stats.turnovers) ?? 0;
  return pts + reb + ast + (stl * 3) + (blk * 3) + fg3m - tov;
}

function extractMatchupSideScore(side: AnyRecord | undefined) {
  if (!side) return undefined;
  return (
    toNumber(side.totalPoints) ??
    toNumber(side.totalScore) ??
    toNumber(side.cumulativeScore?.wins) ??
    toNumber(side.cumulativeScore?.score)
  );
}

function extractMatchupCategories(matchup: AnyRecord) {
  if (matchup.categories != null) return matchup.categories;
  const home = matchup.home?.cumulativeScore ?? matchup.home?.categories;
  const away = matchup.away?.cumulativeScore ?? matchup.away?.categories;
  if (home != null || away != null) {
    return cleanValue({ home, away });
  }
  return undefined;
}

function inferGameStatus(statusRaw: any) {
  const statusText =
    (typeof statusRaw === "string" ? statusRaw : undefined) ??
    statusRaw?.status ??
    statusRaw?.statusText ??
    statusRaw?.time ??
    statusRaw?.period ??
    "";
  const s = String(statusText).toLowerCase();
  if (s.includes("final")) return { status: "final", isActive: false };
  if (s.includes("halftime") || s.includes("q") || s.includes("ot") || s.includes("live") || s.includes("in progress")) {
    return { status: "live", isActive: true };
  }
  return { status: "scheduled", isActive: false };
}

function parseEspnLeagueBundle(
  raw: AnyRecord,
  fetchedAt: number,
): {
  leagueKey: string;
  league: LeagueRow;
  teams: TeamRow[];
  rosters: RosterRow[];
  matchups: MatchupRow[];
  players: PlayerRow[];
} {
  const espnLeagueId = String(raw.id ?? envLeagueId());
  const season = toNumber(raw.seasonId) ?? envSeason();
  const leagueKey = `${espnLeagueId}:${season}`;
  const members = Array.isArray(raw.members) ? raw.members : [];
  const teamsArray = Array.isArray(raw.teams) ? raw.teams : [];
  const scheduleArray = Array.isArray(raw.schedule) ? raw.schedule : [];
  const freeAgentArray =
    (Array.isArray(raw.players) && raw.players) ||
    (Array.isArray(raw.playerPoolEntries) && raw.playerPoolEntries) ||
    [];
  const memberMap = new Map<string, string>();
  for (const member of members) {
    const id = String(member.id ?? "");
    const first = member.firstName ?? "";
    const last = member.lastName ?? "";
    const display = [first, last].filter(Boolean).join(" ").trim() || member.displayName || id;
    if (id) memberMap.set(id, display);
  }

  const league: LeagueRow = cleanValue({
    leagueKey,
    espnLeagueId,
    season,
    name: raw.settings?.name ?? raw.name,
    currentScoringPeriodId: toNumber(raw.scoringPeriodId),
    currentMatchupPeriodId: toNumber(raw.status?.currentMatchupPeriod ?? raw.currentMatchupPeriod),
    scoringSettings: raw.settings?.scoringSettings,
    config: {
      status: {
        currentMatchupPeriod: raw.status?.currentMatchupPeriod,
        firstScoringPeriod: raw.status?.firstScoringPeriod,
        finalScoringPeriod: raw.status?.finalScoringPeriod,
        isActive: raw.status?.isActive,
      },
      settings: {
        name: raw.settings?.name ?? raw.name,
        size: raw.settings?.size,
        scoringType: raw.settings?.scoringSettings?.scoringType,
        matchupPeriodCount: raw.settings?.scheduleSettings?.matchupPeriodCount,
        matchupPeriodLength: raw.settings?.scheduleSettings?.matchupPeriodLength,
        acquisitionLimit: raw.settings?.acquisitionSettings?.acquisitionLimit,
        acquisitionType: raw.settings?.acquisitionSettings?.acquisitionType,
        lineupSlotCounts: raw.settings?.rosterSettings?.lineupSlotCounts,
      },
      entityCounts: {
        members: members.length,
        teams: teamsArray.length,
        schedule: scheduleArray.length,
        freeAgents: freeAgentArray.length,
      },
      scoringPeriodId: raw.scoringPeriodId,
    },
    raw: {
      id: raw.id,
      seasonId: raw.seasonId,
      scoringPeriodId: raw.scoringPeriodId,
      segmentId: raw.segmentId,
      viewSummary: {
        teams: teamsArray.length,
        schedule: scheduleArray.length,
        members: members.length,
        freeAgents: freeAgentArray.length,
      },
    },
    updatedAt: fetchedAt,
  });

  const teamRows: TeamRow[] = [];
  const rosterRows: RosterRow[] = [];
  const playerRows = new Map<string, PlayerRow>();

  for (const team of teamsArray) {
    const teamId = toNumber(team.id);
    if (teamId === undefined) continue;

    const ownerDisplayNames = Array.isArray(team.owners)
      ? team.owners.map((id: any) => memberMap.get(String(id)) ?? String(id))
      : [];
    const record = team.record?.overall ?? team.record;
    const pointsFor = toNumber(record?.pointsFor);
    const pointsAgainst = toNumber(record?.pointsAgainst);

    teamRows.push(cleanValue({
      leagueKey,
      espnTeamId: teamId,
      name:
        team.name ??
        (`${team.location ?? ""} ${team.nickname ?? ""}`.trim() || `Team ${teamId}`),
      abbrev: team.abbrev,
      ownerDisplayNames,
      standingRank: toNumber(team.rankCalculatedFinal ?? team.rankFinal ?? team.currentProjectedRank ?? team.playoffSeed ?? record?.rank),
      wins: toNumber(record?.wins),
      losses: toNumber(record?.losses),
      ties: toNumber(record?.ties),
      pointsFor,
      pointsAgainst,
      record,
      raw: team,
      updatedAt: fetchedAt,
    }));

    const entries = Array.isArray(team.roster?.entries) ? team.roster.entries : [];
    for (const entry of entries) {
      const player = entry.playerPoolEntry?.player ?? entry.player ?? {};
      const espnPlayerId = toNumber(player.id);
      if (espnPlayerId === undefined) continue;
      const playerKey = `espn:${espnPlayerId}`;
      rosterRows.push(cleanValue({
        assignmentKey: `${leagueKey}:${espnPlayerId}`,
        leagueKey,
        espnPlayerId,
        assignmentType: "team" as const,
        espnTeamId: teamId,
        playerName: player.fullName,
        lineupSlotId: toNumber(entry.lineupSlotId),
        lineupSlotName: undefined,
        injuryStatus: player.injuryStatus,
        acquisitionType: entry.acquisitionType != null ? String(entry.acquisitionType) : undefined,
        raw: entry,
        updatedAt: fetchedAt,
      }));

      playerRows.set(playerKey, cleanValue({
        playerKey,
        espnPlayerId,
        fullName: player.fullName ?? `Player ${espnPlayerId}`,
        firstName: player.firstName,
        lastName: player.lastName,
        position: Array.isArray(player.eligibleSlots) ? String(player.eligibleSlots[0]) : undefined,
        positions: Array.isArray(player.eligibleSlots) ? player.eligibleSlots.map((p: any) => String(p)) : undefined,
        nbaTeamAbbr: player.proTeamId != null ? String(player.proTeamId) : undefined,
        injuryStatus: player.injuryStatus,
        isActive: player.active !== undefined ? Boolean(player.active) : undefined,
        raw: player,
        updatedAt: fetchedAt,
      }));
    }
  }

  const freeAgentCandidates = freeAgentArray;
  for (const item of freeAgentCandidates) {
    const entry = item.playerPoolEntry ?? item;
    const player = entry.player ?? item.player ?? {};
    const espnPlayerId = toNumber(player.id);
    if (espnPlayerId === undefined) continue;
    const playerKey = `espn:${espnPlayerId}`;
    if (!rosterRows.some((r) => r.espnPlayerId === espnPlayerId && r.assignmentType === "team")) {
      rosterRows.push(cleanValue({
        assignmentKey: `${leagueKey}:${espnPlayerId}`,
        leagueKey,
        espnPlayerId,
        assignmentType: "free_agent" as const,
        espnTeamId: undefined,
        playerName: player.fullName,
        lineupSlotId: undefined,
        lineupSlotName: "FA",
        injuryStatus: player.injuryStatus,
        acquisitionType: undefined,
        raw: item,
        updatedAt: fetchedAt,
      }));
    }

    if (!playerRows.has(playerKey)) {
      playerRows.set(playerKey, cleanValue({
        playerKey,
        espnPlayerId,
        fullName: player.fullName ?? `Player ${espnPlayerId}`,
        firstName: player.firstName,
        lastName: player.lastName,
        position: Array.isArray(player.eligibleSlots) ? String(player.eligibleSlots[0]) : undefined,
        positions: Array.isArray(player.eligibleSlots) ? player.eligibleSlots.map((p: any) => String(p)) : undefined,
        nbaTeamAbbr: player.proTeamId != null ? String(player.proTeamId) : undefined,
        injuryStatus: player.injuryStatus,
        isActive: player.active !== undefined ? Boolean(player.active) : undefined,
        raw: player,
        updatedAt: fetchedAt,
      }));
    }
  }

  const matchupRows: MatchupRow[] = [];
  for (const matchup of scheduleArray) {
    const matchupPeriodId = toNumber(matchup.matchupPeriodId);
    const homeTeamId = toNumber(matchup.home?.teamId);
    const awayTeamId = toNumber(matchup.away?.teamId);
    if (matchupPeriodId === undefined || homeTeamId === undefined || awayTeamId === undefined) continue;

    matchupRows.push(cleanValue({
      matchupKey: `${leagueKey}:${matchupPeriodId}:${homeTeamId}:${awayTeamId}`,
      leagueKey,
      matchupPeriodId,
      scoringPeriodId: toNumber(matchup.scoringPeriodId),
      homeTeamId,
      awayTeamId,
      homeScore:
        extractMatchupSideScore(matchup.home) ??
        toNumber(
          matchup.home?.pointsByScoringPeriod?.[String(matchup.scoringPeriodId ?? "")]
        ),
      awayScore:
        extractMatchupSideScore(matchup.away) ??
        toNumber(
          matchup.away?.pointsByScoringPeriod?.[String(matchup.scoringPeriodId ?? "")]
        ),
      winner: matchup.winner != null ? String(matchup.winner) : undefined,
      categories: extractMatchupCategories(matchup),
      isPlayoff: matchup.playoffTierType != null,
      raw: matchup,
      updatedAt: fetchedAt,
    }));
  }

  return {
    leagueKey,
    league,
    teams: teamRows,
    rosters: rosterRows,
    matchups: matchupRows,
    players: Array.from(playerRows.values()),
  };
}

function parseBalldontlieGames(raw: AnyRecord, fetchedAt: number): GameRow[] {
  const games = Array.isArray(raw.data) ? raw.data : [];
  return games.map((game: AnyRecord) => {
    const status = inferGameStatus(game.status ?? game);
    const gameDate = String(game.date ?? game.datetime ?? "").slice(0, 10) || isoDate(new Date());
    return cleanValue({
      externalGameId: String(game.id),
      season: toNumber(game.season),
      gameDate,
      startsAt: game.date ?? game.datetime,
      status: status.status,
      isActive: status.isActive,
      homeTeamAbbr: game.home_team?.abbreviation ?? game.home_team?.abbr,
      awayTeamAbbr: game.visitor_team?.abbreviation ?? game.away_team?.abbreviation ?? game.visitor_team?.abbr,
      homeScore: toNumber(game.home_team_score),
      awayScore: toNumber(game.visitor_team_score ?? game.away_team_score),
      raw: game,
      updatedAt: fetchedAt,
    });
  });
}

function parseBalldontliePlayerStats(
  raw: AnyRecord,
  fetchedAt: number,
  season: number,
): { players: PlayerRow[]; playerStats: PlayerStatRow[] } {
  const rows = Array.isArray(raw.data) ? raw.data : [];
  const players = new Map<string, PlayerRow>();
  const playerStats: PlayerStatRow[] = [];

  for (const stat of rows) {
    const player = stat.player ?? {};
    const balldontliePlayerId = toNumber(player.id);
    if (balldontliePlayerId === undefined) continue;
    const playerKey = `bdl:${balldontliePlayerId}`;
    players.set(playerKey, cleanValue({
      playerKey,
      balldontliePlayerId,
      fullName:
        [player.first_name, player.last_name].filter(Boolean).join(" ").trim() ||
        player.full_name ||
        `Player ${balldontliePlayerId}`,
      firstName: player.first_name,
      lastName: player.last_name,
      position: player.position || undefined,
      nbaTeamAbbr: stat.team?.abbreviation ?? player.team?.abbreviation,
      isActive: true,
      raw: player,
      updatedAt: fetchedAt,
    }));

    const game = stat.game ?? {};
    const gameId = game.id != null ? String(game.id) : undefined;
    const gameDate = (game.date ?? "").slice(0, 10) || undefined;
    playerStats.push(cleanValue({
      statKey: `game:${gameId ?? "unknown"}:${playerKey}`,
      playerKey,
      balldontliePlayerId,
      statType: "game" as const,
      gameId,
      season,
      gameDate,
      fantasyScore: computeFantasyScore(stat),
      stats: {
        min: stat.min,
        pts: stat.pts,
        reb: stat.reb,
        ast: stat.ast,
        stl: stat.stl,
        blk: stat.blk,
        turnover: stat.turnover,
        fg3m: stat.fg3m,
        fg_pct: stat.fg_pct,
        ft_pct: stat.ft_pct,
      },
      raw: stat,
      updatedAt: fetchedAt,
    }));
  }

  return { players: Array.from(players.values()), playerStats };
}

function parseBalldontlieSeasonAverages(
  raw: AnyRecord,
  fetchedAt: number,
  season: number,
): PlayerStatRow[] {
  const rows = Array.isArray(raw.data) ? raw.data : [];
  const out: PlayerStatRow[] = [];
  for (const avg of rows) {
    const balldontliePlayerId = toNumber(avg.player_id);
    if (balldontliePlayerId === undefined) continue;
    const playerKey = `bdl:${balldontliePlayerId}`;
    out.push(
      cleanValue({
        statKey: `season_average:${season}:${playerKey}`,
        playerKey,
        balldontliePlayerId,
        statType: "season_average" as const,
        season,
        gameDate: undefined,
        fantasyScore: computeFantasyScore(avg),
        stats: avg,
        raw: avg,
        updatedAt: fetchedAt,
      }),
    );
  }
  return out;
}

async function runSyncWithLogging(
  ctx: any,
  syncType: "syncLeague" | "syncLive" | "syncSchedule",
  fn: () => Promise<{ status?: "success" | "skipped"; recordCounts?: AnyRecord; meta?: AnyRecord }>,
) {
  const logId = await ctx.runMutation(internal.mutations.beginSyncLog, { syncType });
  try {
    const result = await fn();
    await ctx.runMutation(internal.mutations.finishSyncLog, {
      logId,
      status: result.status ?? "success",
      recordCounts: result.recordCounts,
      meta: result.meta,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ctx.runMutation(internal.mutations.finishSyncLog, {
      logId,
      status: "error",
      error: message,
    });
    throw error;
  }
}

export const getActiveGames = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("games")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const runSyncLeague = internalAction({
  args: {},
  handler: async (ctx) => {
    return await runSyncWithLogging(ctx, "syncLeague", async () => {
      const fetchedAt = Date.now();
      const espnRaw = await ctx.runAction(internal.espn.fetchLeagueViews, {
        views: ["mSettings", "mStatus", "mStandings", "mRoster", "mMatchup", "mFreeAgents"],
      });

      const parsed = parseEspnLeagueBundle(espnRaw, fetchedAt);

      const counts: AnyRecord = {};
      counts.league = await ctx.runMutation(internal.mutations.upsertLeague, { league: parsed.league });
      counts.teams = await ctx.runMutation(internal.mutations.upsertTeams, { teams: parsed.teams });
      counts.rosters = await ctx.runMutation(internal.mutations.upsertRosters, { rows: parsed.rosters });
      counts.matchups = await ctx.runMutation(internal.mutations.upsertMatchups, { rows: parsed.matchups });
      counts.players = await ctx.runMutation(internal.mutations.upsertPlayers, { rows: parsed.players });

      return {
        status: "success",
        recordCounts: counts,
        meta: cleanValue({ leagueKey: parsed.leagueKey }),
      };
    });
  },
});

export const runSyncSchedule = internalAction({
  args: {},
  handler: async (ctx) => {
    return await runSyncWithLogging(ctx, "syncSchedule", async () => {
      const fetchedAt = Date.now();
      const today = new Date();
      const startDate = isoDate(today);
      const endDate = isoDate(addDays(today, 7));
      const gamesRaw = await ctx.runAction(internal.stats.fetchGamesRange, {
        startDate,
        endDate,
        perPage: 100,
      });

      const games = parseBalldontlieGames(gamesRaw, fetchedAt);
      const counts: AnyRecord = {};
      counts.games = await ctx.runMutation(internal.mutations.upsertGames, { rows: games });

      return {
        status: "success",
        recordCounts: counts,
        meta: cleanValue({ startDate, endDate }),
      };
    });
  },
});

export const runSyncLive = internalAction({
  args: {},
  handler: async (ctx) => {
    return await runSyncWithLogging(ctx, "syncLive", async () => {
      const existingActiveGames = await ctx.runQuery(internal.sync.getActiveGames, {});
      if (existingActiveGames.length === 0) {
        return {
          status: "skipped",
          recordCounts: { gamesActive: 0 },
          meta: cleanValue({ reason: "No active games in games table" }),
        };
      }

      const fetchedAt = Date.now();
      const today = isoDate(new Date());
      const gamesRaw = await ctx.runAction(internal.stats.fetchGamesRange, {
        startDate: today,
        endDate: today,
        perPage: 100,
      });
      const gameRows = parseBalldontlieGames(gamesRaw, fetchedAt);
      const gameCounts = await ctx.runMutation(internal.mutations.upsertGames, { rows: gameRows });

      const activeGameIds = gameRows.filter((g) => g.isActive).map((g) => g.externalGameId);
      const counts: AnyRecord = { games: gameCounts };

      if (activeGameIds.length > 0) {
        const statsRaw = await ctx.runAction(internal.stats.fetchGameStats, {
          gameIds: activeGameIds,
          perPage: 100,
        });
        const parsedStats = parseBalldontliePlayerStats(statsRaw, fetchedAt, envSeason());
        counts.livePlayers = await ctx.runMutation(internal.mutations.upsertPlayers, {
          rows: parsedStats.players,
        });
        counts.livePlayerStats = await ctx.runMutation(internal.mutations.upsertPlayerStats, {
          rows: parsedStats.playerStats,
        });
      }

      const espnRaw = await ctx.runAction(internal.espn.fetchLeagueViews, {
        views: ["mRoster", "mMatchup", "mStandings", "mStatus"],
      });
      const parsedEspn = parseEspnLeagueBundle(espnRaw, fetchedAt);
      counts.teams = await ctx.runMutation(internal.mutations.upsertTeams, { teams: parsedEspn.teams });
      counts.rosters = await ctx.runMutation(internal.mutations.upsertRosters, { rows: parsedEspn.rosters });
      counts.matchups = await ctx.runMutation(internal.mutations.upsertMatchups, { rows: parsedEspn.matchups });
      counts.espnPlayers = await ctx.runMutation(internal.mutations.upsertPlayers, { rows: parsedEspn.players });

      return {
        status: "success",
        recordCounts: counts,
        meta: cleanValue({ activeGameIds }),
      };
    });
  },
});

export const syncSeasonAveragesForTrackedPlayers = internalAction({
  args: {},
  handler: async (ctx) => {
    return await runSyncWithLogging(ctx, "syncLive", async () => {
      const fetchedAt = Date.now();
      const leagueKey = leagueKeyFromEnv();
      const rosterRows = await ctx.runQuery(internal.queries.getTrackedPlayersForSync, { leagueKey });
      const candidateIds = Array.from(
        new Set(
          rosterRows
            .map((p: any) => (p.balldontliePlayerId != null ? String(p.balldontliePlayerId) : undefined))
            .filter(Boolean),
        ),
      ) as string[];

      if (candidateIds.length === 0) {
        return { status: "skipped", recordCounts: { seasonAverageCandidates: 0 } };
      }

      const raw = await ctx.runAction(internal.stats.fetchSeasonAverages, {
        season: envSeason(),
        playerIds: candidateIds.slice(0, 100),
      });
      const statsRows = parseBalldontlieSeasonAverages(raw, fetchedAt, envSeason());
      const counts: AnyRecord = await ctx.runMutation(internal.mutations.upsertPlayerStats, {
        rows: statsRows as any[],
      });
      return { status: "success", recordCounts: { seasonAverages: counts } };
    });
  },
});
