import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";

function envLeagueKey() {
  const leagueId = process.env.ESPN_LEAGUE_ID ?? process.env.LEAGUE_ID;
  const season = process.env.ESPN_SEASON ?? process.env.LEAGUE_YEAR;
  if (!leagueId || !season) return undefined;
  return `${leagueId}:${Number(season)}`;
}

function scoreForSort(item: any) {
  if (typeof item?.seasonAverage?.fantasyScore === "number")
    return item.seasonAverage.fantasyScore;
  if (typeof item?.latestGame?.fantasyScore === "number")
    return item.latestGame.fantasyScore;
  return -Infinity;
}

function normalizeName(name?: string | null) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/%/g, "").trim();
    if (cleaned !== "" && !Number.isNaN(Number(cleaned))) return Number(cleaned);
  }
  return undefined;
}

function canonicalStatLabel(statId: string, rawLabel?: string) {
  const known: Record<string, string> = {
    "0": "PTS",
    "1": "BLK",
    "2": "STL",
    "3": "AST",
    "6": "REB",
    "13": "FGM",
    "14": "FGA",
    "15": "FTM",
    "16": "FTA",
    "17": "3PM",
    "19": "TO",
    "20": "FT%",
    "22": "AFG%",
    "43": "GS",
    "44": "DD",
    "45": "TD",
    "37": "MATCHUP ACQ",
    "42": "GAMES PLAYED",
  };
  if (known[statId]) return known[statId];
  const label = (rawLabel ?? "").toUpperCase();
  if (label.includes("FIELD GOAL")) return "FG%";
  if (label.includes("FREE THROW")) return "FT%";
  if (label.includes("THREE") || label.includes("3PT")) return "3PM";
  if (label === "TURNOVERS" || label === "TO") return "TO";
  return label || `STAT ${statId}`;
}

function buildStatLabelMap(scoringSettings: any): Record<string, string> {
  const statSettings = scoringSettings?.statSettings;
  if (!statSettings || typeof statSettings !== "object") return {};
  const out: Record<string, string> = {};
  const entries = Array.isArray(statSettings)
    ? (statSettings as any[])
        .filter(Boolean)
        .map((config) => [String(config?.id ?? config?.statId ?? ""), config] as const)
        .filter(([statId]) => statId !== "")
    : Object.entries(statSettings as Record<string, any>);
  for (const [statId, config] of entries) {
    out[statId] = canonicalStatLabel(
      statId,
      config?.name ??
        config?.abbr ??
        config?.abbrev ??
        config?.abbreviation ??
        config?.displayName ??
        config?.shortName,
    );
  }
  return out;
}

function extractEntryScore(entry: any) {
  return (
    toNumber(entry) ??
    toNumber(entry?.score) ??
    toNumber(entry?.value) ??
    toNumber(entry?.statScore) ??
    toNumber(entry?.displayValue)
  );
}

function extractEntryResult(entry: any): string | undefined {
  const raw = entry?.result ?? entry?.outcome ?? entry?.matchupResult;
  if (raw == null) return undefined;
  const s = String(raw).toLowerCase();
  if (s.includes("win")) return "win";
  if (s.includes("loss")) return "loss";
  if (s.includes("tie")) return "tie";
  return undefined;
}

function normalizePercentValue(label: string, value: number) {
  if (!label.includes("%")) return value;
  return value > 1 ? value / 100 : value;
}

function buildCategoryBreakdown(
  categories: any,
  myTeamIsHome: boolean,
  statLabels: Record<string, string>,
) {
  const home = categories?.home;
  const away = categories?.away;
  const homeByStat = home?.scoreByStat;
  const awayByStat = away?.scoreByStat;
  if (!homeByStat || !awayByStat) return null;

  const keys = Array.from(
    new Set([...Object.keys(homeByStat), ...Object.keys(awayByStat)]),
  ).filter((key) => !["_id", "wins", "losses", "ties"].includes(key));

  const rows = keys
    .map((statId) => {
      const homeEntry = homeByStat[statId];
      const awayEntry = awayByStat[statId];
      const homeScoreRaw = extractEntryScore(homeEntry);
      const awayScoreRaw = extractEntryScore(awayEntry);
      if (homeScoreRaw === undefined && awayScoreRaw === undefined) return null;

      const label = statLabels[statId] ?? canonicalStatLabel(statId);
      const homeScore = normalizePercentValue(label, homeScoreRaw ?? 0);
      const awayScore = normalizePercentValue(label, awayScoreRaw ?? 0);
      const mine = myTeamIsHome ? homeScore : awayScore;
      const theirs = myTeamIsHome ? awayScore : homeScore;

      const mineResult = extractEntryResult(myTeamIsHome ? homeEntry : awayEntry);
      const isTurnover = label === "TO" || label === "TURNOVERS";
      const winning =
        mineResult === "win"
          ? true
          : mineResult === "loss"
            ? false
            : mineResult === "tie"
              ? false
              : isTurnover
                ? mine < theirs
                : mine > theirs;

      return {
        statId,
        name: label,
        mine,
        theirs,
        winning,
      };
    })
    .filter(Boolean);

  if (rows.length === 0) return null;

  // Helper counting stats used to derive FG%/AFG%/FT% should not render as categories.
  const helperStatIds = new Set(["13", "14", "15", "16"]);
  return rows.filter((row: any) => !helperStatIds.has(String(row.statId)));
}

function isPlaceholderTeamName(name: unknown) {
  return typeof name === "string" && /^team\s*\d+$/i.test(name.trim());
}

function extractTeamNameFromSource(team: any, matchupSide: any, fallbackId?: number) {
  const directTeamName = team?.name;
  if (
    typeof directTeamName === "string" &&
    directTeamName.trim() &&
    !isPlaceholderTeamName(directTeamName)
  ) {
    return directTeamName.trim();
  }

  const sideCandidates = [
    matchupSide?.teamName,
    matchupSide?.name,
    matchupSide?.team?.name,
    matchupSide?.team?.teamName,
    matchupSide?.team?.displayName,
  ];
  for (const candidate of sideCandidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }

  const location =
    (typeof team?.raw?.location === "string" && team.raw.location) ||
    (typeof matchupSide?.team?.location === "string" && matchupSide.team.location) ||
    (typeof matchupSide?.location === "string" && matchupSide.location);
  const nickname =
    (typeof team?.raw?.nickname === "string" && team.raw.nickname) ||
    (typeof matchupSide?.team?.nickname === "string" && matchupSide.team.nickname) ||
    (typeof matchupSide?.nickname === "string" && matchupSide.nickname);
  const combined = [location, nickname].filter(Boolean).join(" ").trim();
  if (combined) return combined;

  const abbrev =
    (typeof team?.abbrev === "string" && team.abbrev) ||
    (typeof matchupSide?.team?.abbrev === "string" && matchupSide.team.abbrev) ||
    (typeof matchupSide?.abbrev === "string" && matchupSide.abbrev);
  if (abbrev) return abbrev;

  return fallbackId != null ? `Team ${fallbackId}` : "Unknown Team";
}

function mergeTeamDisplay(team: any, matchupSide: any, fallbackId?: number) {
  const placeholderName = isPlaceholderTeamName(team?.name);
  const nestedRecord = team?.record?.overall ?? team?.record ?? team?.raw?.record?.overall ?? team?.raw?.record;
  const wins = team?.wins ?? toNumber(nestedRecord?.wins);
  const losses = team?.losses ?? toNumber(nestedRecord?.losses);
  const ties = team?.ties ?? toNumber(nestedRecord?.ties);

  if (!team) {
    return {
      name: extractTeamNameFromSource(null, matchupSide, fallbackId),
      wins: toNumber(matchupSide?.record?.wins) ?? wins,
      losses: toNumber(matchupSide?.record?.losses) ?? losses,
      ties: toNumber(matchupSide?.record?.ties) ?? ties,
      standingRank: undefined,
    };
  }
  if (team.name && !placeholderName && wins != null && losses != null && ties != null) return team;
  return {
    ...team,
    name:
      !team.name || placeholderName
        ? extractTeamNameFromSource(team, matchupSide, fallbackId)
        : team.name,
    wins,
    losses,
    ties,
  };
}

async function resolveLeagueKey(ctx: any, requestedLeagueKey?: string) {
  if (requestedLeagueKey) return requestedLeagueKey;
  const envKey = envLeagueKey();
  if (envKey) return envKey;
  const latest = await ctx.db.query("leagues").order("desc").first();
  return latest?.leagueKey;
}

async function getLatestStatForPlayer(
  ctx: any,
  playerKey: string,
  statType: "game" | "season_average"
) {
  const rows = await ctx.db
    .query("playerStats")
    .withIndex("by_playerKey_statType", (q: any) =>
      q.eq("playerKey", playerKey).eq("statType", statType)
    )
    .order("desc")
    .take(1);
  return rows[0] ?? null;
}

async function getPlayerByEspnId(ctx: any, espnPlayerId: number) {
  return await ctx.db
    .query("players")
    .withIndex("by_espnPlayerId", (q: any) =>
      q.eq("espnPlayerId", espnPlayerId)
    )
    .first();
}

async function getTeamByLeagueAndId(ctx: any, leagueKey: string, espnTeamId: number) {
  const exact = await ctx.db
    .query("teams")
    .withIndex("by_leagueKey_teamId", (q: any) =>
      q.eq("leagueKey", leagueKey).eq("espnTeamId", espnTeamId),
    )
    .unique();
  if (exact) return exact;

  // Fallback if leagueKey drifted between syncs; prefer any matching team id.
  const allTeams = await ctx.db.query("teams").collect();
  return allTeams.find((team: any) => team.espnTeamId === espnTeamId) ?? null;
}

async function resolveMyTeamId(ctx: any, leagueKey: string) {
  const envTeamId = process.env.TEAM_ID;
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
        q.eq("leagueKey", args.leagueKey).eq("assignmentType", "team")
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
    return teams.sort(
      (a, b) => (a.standingRank ?? 999) - (b.standingRank ?? 999)
    );
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
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .unique();
    const currentPeriod = league?.currentMatchupPeriodId;

    const allMatchups = await ctx.db
      .query("matchups")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .collect();
    const relevant = allMatchups.filter(
      (m) => m.homeTeamId === myTeamId || m.awayTeamId === myTeamId
    );
    if (relevant.length === 0) return null;

    const currentMatchup =
      typeof currentPeriod === "number"
        ? relevant.find((m) => m.matchupPeriodId === currentPeriod)
        : null;

    const matchup =
      currentMatchup ??
      [...relevant].sort(
        (a, b) => (b.matchupPeriodId ?? 0) - (a.matchupPeriodId ?? 0)
      )[0];

    const [homeTeam, awayTeam] = await Promise.all([
      getTeamByLeagueAndId(ctx, leagueKey, matchup.homeTeamId),
      getTeamByLeagueAndId(ctx, leagueKey, matchup.awayTeamId),
    ]);

    const myTeamIsHome = matchup.homeTeamId === myTeamId;
    const rawHomeSide = (matchup as any).raw?.home ?? null;
    const rawAwaySide = (matchup as any).raw?.away ?? null;
    const resolvedHomeTeam = mergeTeamDisplay(homeTeam, rawHomeSide, matchup.homeTeamId);
    const resolvedAwayTeam = mergeTeamDisplay(awayTeam, rawAwaySide, matchup.awayTeamId);
    const myTeam = myTeamIsHome ? resolvedHomeTeam : resolvedAwayTeam;
    const opponent = myTeamIsHome ? resolvedAwayTeam : resolvedHomeTeam;
    const statLabels = buildStatLabelMap(league?.scoringSettings);
    const categoryBreakdown = buildCategoryBreakdown(
      matchup.categories,
      myTeamIsHome,
      statLabels,
    );
    const homeWins = toNumber(matchup.categories?.home?.wins) ?? 0;
    const awayWins = toNumber(matchup.categories?.away?.wins) ?? 0;
    const homeLosses = toNumber(matchup.categories?.home?.losses) ?? 0;
    const awayLosses = toNumber(matchup.categories?.away?.losses) ?? 0;
    const homeTies = toNumber(matchup.categories?.home?.ties) ?? 0;
    const awayTies = toNumber(matchup.categories?.away?.ties) ?? 0;
    const myCategoryWins = myTeamIsHome ? homeWins : awayWins;
    const oppCategoryWins = myTeamIsHome ? awayWins : homeWins;
    const myCategoryLosses = myTeamIsHome ? homeLosses : awayLosses;
    const oppCategoryLosses = myTeamIsHome ? awayLosses : homeLosses;
    const myCategoryTies = myTeamIsHome ? homeTies : awayTies;
    const oppCategoryTies = myTeamIsHome ? awayTies : homeTies;
    const rawRows = Array.isArray(categoryBreakdown) ? categoryBreakdown : [];
    const metaRows = rawRows.filter(
      (row: any) => row?.statId === "37" || row?.statId === "42",
    );
    const visibleCategoryRows = rawRows.filter(
      (row: any) => row?.statId !== "37" && row?.statId !== "42",
    );
    const rawMyScore = myTeamIsHome ? matchup.homeScore : matchup.awayScore;
    const rawOpponentScore = myTeamIsHome ? matchup.awayScore : matchup.homeScore;
    const shouldUseCategoryScoreFallback =
      (rawMyScore == null && rawOpponentScore == null) ||
      ((rawMyScore ?? 0) === 0 &&
        (rawOpponentScore ?? 0) === 0 &&
        (myCategoryWins !== 0 || oppCategoryWins !== 0));
    const myScoreValue = shouldUseCategoryScoreFallback ? myCategoryWins : rawMyScore;
    const opponentScoreValue = shouldUseCategoryScoreFallback
      ? oppCategoryWins
      : rawOpponentScore;

    return {
      ...matchup,
      myTeamId,
      currentMatchupPeriodId: currentPeriod,
      homeTeam: resolvedHomeTeam,
      awayTeam: resolvedAwayTeam,
      myTeamIsHome,
      myTeam,
      opponent,
      myScore: myScoreValue,
      opponentScore: opponentScoreValue,
      matchupScoreSummary: {
        myWins: myCategoryWins,
        myLosses: myCategoryLosses,
        myTies: myCategoryTies,
        opponentWins: oppCategoryWins,
        opponentLosses: oppCategoryLosses,
        opponentTies: oppCategoryTies,
      },
      statLabels,
      categoryBreakdown: visibleCategoryRows,
      metaBreakdown: metaRows,
      debugMatchupStats: {
        homeScoreByStatKeys: Object.keys(matchup.categories?.home?.scoreByStat ?? {}),
        awayScoreByStatKeys: Object.keys(matchup.categories?.away?.scoreByStat ?? {}),
        visibleStatIds: visibleCategoryRows.map((row: any) => row.statId),
        metaStatIds: metaRows.map((row: any) => row.statId),
      },
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
      .withIndex("by_leagueKey_teamId", (q) =>
        q.eq("leagueKey", leagueKey).eq("espnTeamId", myTeamId)
      )
      .collect();

    const allPlayers = await ctx.db.query("players").collect();
    const bdlPlayersByName = new Map<string, any>();
    for (const p of allPlayers) {
      if (!String(p.playerKey ?? "").startsWith("bdl:")) continue;
      const key = normalizeName(p.fullName);
      if (key && !bdlPlayersByName.has(key)) bdlPlayersByName.set(key, p);
    }

    const result = [];
    for (const roster of rosterRows.filter(
      (r) => r.assignmentType === "team"
    )) {
      const player = await getPlayerByEspnId(ctx, roster.espnPlayerId);
      const bdlPlayer =
        player && String(player.playerKey).startsWith("bdl:")
          ? player
          : bdlPlayersByName.get(
              normalizeName(player?.fullName ?? roster.playerName)
            );
      const espnPlayerKey = `espn:${roster.espnPlayerId}`;
      const seasonAverage =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "season_average")) ??
        (player?.playerKey
          ? await getLatestStatForPlayer(
              ctx,
              player.playerKey,
              "season_average"
            )
          : null) ??
        (bdlPlayer?.playerKey
          ? await getLatestStatForPlayer(
              ctx,
              bdlPlayer.playerKey,
              "season_average"
            )
          : null);
      const latestGame =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "game")) ??
        (player?.playerKey
          ? await getLatestStatForPlayer(ctx, player.playerKey, "game")
          : null) ??
        (bdlPlayer?.playerKey
          ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "game")
          : null);

      result.push({
        roster,
        player: player ?? bdlPlayer ?? null,
        stats: {
          seasonAverage,
          latestGame,
        },
      });
    }

    return result.sort((a, b) =>
      String(a.roster.playerName ?? "").localeCompare(
        String(b.roster.playerName ?? "")
      )
    );
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
        q.eq("leagueKey", leagueKey).eq("assignmentType", "free_agent")
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
          : bdlPlayersByName.get(
              normalizeName(player?.fullName ?? roster.playerName)
            );
      const espnPlayerKey = `espn:${roster.espnPlayerId}`;
      const seasonAverage =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "season_average")) ??
        (player?.playerKey
          ? await getLatestStatForPlayer(
              ctx,
              player.playerKey,
              "season_average"
            )
          : null) ??
        (bdlPlayer?.playerKey
          ? await getLatestStatForPlayer(
              ctx,
              bdlPlayer.playerKey,
              "season_average"
            )
          : null);
      const latestGame =
        (await getLatestStatForPlayer(ctx, espnPlayerKey, "game")) ??
        (player?.playerKey
          ? await getLatestStatForPlayer(ctx, player.playerKey, "game")
          : null) ??
        (bdlPlayer?.playerKey
          ? await getLatestStatForPlayer(ctx, bdlPlayer.playerKey, "game")
          : null);
      hydrated.push({
        roster,
        player: player ?? bdlPlayer ?? null,
        seasonAverage,
        latestGame,
      });
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
        .withIndex("by_syncType_startedAt", (q) =>
          q.eq("syncType", args.syncType!)
        )
        .order("desc")
        .take(limit);
      return rows;
    }
    return await ctx.db
      .query("syncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(limit);
  },
});

export const getCurrentMatchupDebug = query({
  args: {},
  handler: async (ctx) => {
    const leagueKey = await resolveLeagueKey(ctx, undefined);
    if (!leagueKey) return null;
    const myTeamId = await resolveMyTeamId(ctx, leagueKey);
    if (myTeamId == null) return null;
    const league = await ctx.db
      .query("leagues")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .unique();
    const allMatchups = await ctx.db
      .query("matchups")
      .withIndex("by_leagueKey", (q) => q.eq("leagueKey", leagueKey))
      .collect();
    const relevant = allMatchups.filter(
      (m) => m.homeTeamId === myTeamId || m.awayTeamId === myTeamId,
    );
    if (relevant.length === 0) return null;
    const currentMatchup =
      typeof league?.currentMatchupPeriodId === "number"
        ? relevant.find((m) => m.matchupPeriodId === league.currentMatchupPeriodId)
        : null;
    const matchup =
      currentMatchup ??
      [...relevant].sort((a, b) => (b.matchupPeriodId ?? 0) - (a.matchupPeriodId ?? 0))[0];

    const [homeTeam, awayTeam] = await Promise.all([
      getTeamByLeagueAndId(ctx, leagueKey, matchup.homeTeamId),
      getTeamByLeagueAndId(ctx, leagueKey, matchup.awayTeamId),
    ]);
    const myTeamIsHome = matchup.homeTeamId === myTeamId;
    const rawHome = (matchup as any).raw?.home ?? null;
    const rawAway = (matchup as any).raw?.away ?? null;
    const resolvedHome = mergeTeamDisplay(homeTeam, rawHome, matchup.homeTeamId);
    const resolvedAway = mergeTeamDisplay(awayTeam, rawAway, matchup.awayTeamId);
    const statLabels = buildStatLabelMap(league?.scoringSettings);
    const fullCategoryBreakdown = buildCategoryBreakdown(
      matchup.categories,
      myTeamIsHome,
      statLabels,
    ) ?? [];
    const homeRaw = rawHome;
    const awayRaw = rawAway;

    return {
      matchupPeriodId: matchup.matchupPeriodId,
      myTeamId,
      myTeamIsHome,
      myTeam: myTeamIsHome ? resolvedHome : resolvedAway,
      opponent: myTeamIsHome ? resolvedAway : resolvedHome,
      homeTeam: resolvedHome,
      awayTeam: resolvedAway,
      scoreByStatKeys: {
        home: Object.keys(matchup.categories?.home?.scoreByStat ?? {}),
        away: Object.keys(matchup.categories?.away?.scoreByStat ?? {}),
      },
      statLabels,
      fullCategoryBreakdown,
      rawTeamNameCandidates: {
        home: {
          teamName: homeRaw?.teamName,
          name: homeRaw?.name,
          teamNameNested: homeRaw?.team?.name,
          location: homeRaw?.team?.location ?? homeRaw?.location,
          nickname: homeRaw?.team?.nickname ?? homeRaw?.nickname,
          abbrev: homeRaw?.team?.abbrev ?? homeRaw?.abbrev,
          record: homeRaw?.record,
        },
        away: {
          teamName: awayRaw?.teamName,
          name: awayRaw?.name,
          teamNameNested: awayRaw?.team?.name,
          location: awayRaw?.team?.location ?? awayRaw?.location,
          nickname: awayRaw?.team?.nickname ?? awayRaw?.nickname,
          abbrev: awayRaw?.team?.abbrev ?? awayRaw?.abbrev,
          record: awayRaw?.record,
        },
      },
      leagueScoringSettingsShape: {
        hasScoringSettings: Boolean(league?.scoringSettings),
        statSettingsType: Array.isArray(league?.scoringSettings?.statSettings)
          ? "array"
          : typeof league?.scoringSettings?.statSettings,
        statSettingKeys: Array.isArray(league?.scoringSettings?.statSettings)
          ? (league?.scoringSettings?.statSettings ?? []).map((s: any) => s?.id ?? s?.statId)
          : Object.keys(league?.scoringSettings?.statSettings ?? {}),
      },
    };
  },
});
