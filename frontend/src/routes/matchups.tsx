import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import {
  api,
  asNumber,
  convexArgs,
  formatAgoFromMs,
  isConvexEnabled,
} from "~/lib/convex-bridge";
import { normalizeCategoryBreakdown, toRecordString } from "~/lib/matchup";

export const Route = createFileRoute("/matchups")({
  component: Matchups,
});

// Mock data — will be replaced by Convex useQuery(api.queries.getCurrentMatchup)
const mockMatchup = {
  week: 18,
  myTeam: { name: "David's Team", record: "12-5-0" },
  opponent: { name: "Mike's Squad", record: "10-7-0" },
  categories: [
    { name: "AFG%", mine: 0.487, theirs: 0.472, winning: true },
    { name: "FT%", mine: 0.815, theirs: 0.832, winning: false },
    { name: "3PM", mine: 45, theirs: 42, winning: true },
    { name: "REB", mine: 198, theirs: 210, winning: false },
    { name: "AST", mine: 125, theirs: 118, winning: true },
    { name: "STL", mine: 32, theirs: 28, winning: true },
    { name: "BLK", mine: 18, theirs: 22, winning: false },
    { name: "DD", mine: 22, theirs: 20, winning: true },
    { name: "PTS", mine: 482, theirs: 456, winning: false },
  ],
};

type MatchupCategoryRow = {
  name: string;
  mine: number;
  theirs: number;
  winning: boolean;
};

function Matchups() {
  const matchupQuery = useQuery(
    convexQuery(api.queries.getCurrentMatchup, convexArgs({}))
  );
  const syncLogQuery = useQuery(
    convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 }))
  );

  const matchup =
    isConvexEnabled && matchupQuery.data
      ? {
          week:
            matchupQuery.data.matchupPeriodId ??
            matchupQuery.data.scoringPeriodId ??
            "—",
          myTeam: {
            name:
              matchupQuery.data.myTeam?.name ??
              `Team ${matchupQuery.data.myTeamId ?? matchupQuery.data.homeTeamId}`,
            record: toRecordString(matchupQuery.data.myTeam),
          },
          opponent: {
            name:
              matchupQuery.data.opponent?.name ??
              `Team ${
                matchupQuery.data.myTeamIsHome
                  ? matchupQuery.data.awayTeamId
                  : matchupQuery.data.homeTeamId
              }`,
            record: toRecordString(matchupQuery.data.opponent),
          },
          categories:
            (Array.isArray((matchupQuery.data as any).categoryBreakdown)
              ? (matchupQuery.data as any).categoryBreakdown
              : null) ??
            normalizeCategoryBreakdown(
              matchupQuery.data.scoringBreakdown,
              matchupQuery.data
            ),
          meta: Array.isArray((matchupQuery.data as any).metaBreakdown)
            ? (matchupQuery.data as any).metaBreakdown
            : [],
          scoreSummary: (matchupQuery.data as any).matchupScoreSummary ?? null,
          headerMyCategories: asNumber((matchupQuery.data as any).myScore, NaN),
          headerOppCategories: asNumber(
            (matchupQuery.data as any).opponentScore,
            NaN
          ),
        }
      : {
          ...mockMatchup,
          meta: [],
          scoreSummary: null,
          headerMyCategories: NaN,
          headerOppCategories: NaN,
        };

  const fallbackMyWins = (matchup.categories as MatchupCategoryRow[]).filter(
    (c) => c.winning
  ).length;
  const fallbackTheirWins = (matchup.categories as MatchupCategoryRow[]).filter(
    (c) => !c.winning
  ).length;
  const myWins = Number.isFinite(matchup.headerMyCategories)
    ? matchup.headerMyCategories
    : fallbackMyWins;
  const theirWins = Number.isFinite(matchup.headerOppCategories)
    ? matchup.headerOppCategories
    : fallbackTheirWins;
  const metaByName = new Map(
    (matchup.meta as any[]).map((row) => [String(row.name), row])
  );
  const myGamesPlayed = metaByName.get("GAMES PLAYED")?.mine;
  const oppGamesPlayed = metaByName.get("GAMES PLAYED")?.theirs;
  const myAcq = metaByName.get("MATCHUP ACQ")?.mine;
  const oppAcq = metaByName.get("MATCHUP ACQ")?.theirs;
  const lastSyncedMs =
    (syncLogQuery.data?.[0] as any)?.finishedAt ??
    (syncLogQuery.data?.[0] as any)?.startedAt;
  const lastSyncedLabel = isConvexEnabled
    ? formatAgoFromMs(lastSyncedMs)
    : "2 minutes ago";

  return (
    <div>
      <h1 className="text-3xl font-black uppercase mb-6">
        Week {matchup.week} Matchup
      </h1>

      {isConvexEnabled && matchupQuery.error ? (
        <div className="brutal-card p-4 mb-4 border-brutal-red">
          <div className="font-bold text-brutal-red">
            Failed to load matchup
          </div>
          <div className="text-sm">{matchupQuery.error.message}</div>
        </div>
      ) : null}

      {isConvexEnabled && matchupQuery.isLoading ? (
        <div className="brutal-card p-4 mb-4">
          <div className="font-bold">Loading matchup...</div>
        </div>
      ) : null}

      {/* Score header */}
      <div className="brutal-card p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <div className="text-lg font-black uppercase">
              {matchup.myTeam.name}
            </div>
            <div className="text-sm font-mono text-muted">
              {matchup.myTeam.record}
            </div>
            {typeof myGamesPlayed === "number" || typeof myAcq === "number" ? (
              <div className="mt-2 text-xs font-bold text-muted space-y-1">
                {typeof myGamesPlayed === "number" ? (
                  <div>Games: {myGamesPlayed}</div>
                ) : null}
                {typeof myAcq === "number" ? (
                  <div>Matchup Acq: {myAcq}</div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="text-center px-8">
            <div className="flex items-center gap-3">
              <span
                className={`text-5xl font-black ${myWins > theirWins ? "text-brutal-green" : "text-brutal-red"}`}
              >
                {myWins}
              </span>
              <span className="text-3xl font-bold text-muted">-</span>
              <span
                className={`text-5xl font-black ${theirWins > myWins ? "text-brutal-green" : "text-brutal-red"}`}
              >
                {theirWins}
              </span>
            </div>
            <div className="text-xs font-bold uppercase text-muted mt-1">
              Categories
            </div>
            {matchup.scoreSummary?.myTies ||
            matchup.scoreSummary?.opponentTies ? (
              <div className="text-xs font-mono text-muted mt-1">
                Ties: {matchup.scoreSummary?.myTies ?? 0}
              </div>
            ) : null}
          </div>
          <div className="text-center flex-1">
            <div className="text-lg font-black uppercase">
              {matchup.opponent.name}
            </div>
            <div className="text-sm font-mono text-muted">
              {matchup.opponent.record}
            </div>
            {typeof oppGamesPlayed === "number" ||
            typeof oppAcq === "number" ? (
              <div className="mt-2 text-xs font-bold text-muted space-y-1">
                {typeof oppGamesPlayed === "number" ? (
                  <div>Games: {oppGamesPlayed}</div>
                ) : null}
                {typeof oppAcq === "number" ? (
                  <div>Matchup Acq: {oppAcq}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 gap-4">
        {(matchup.categories as MatchupCategoryRow[]).map((cat) => (
          <div
            key={cat.name}
            className={`brutal-card p-4 ${cat.winning ? "border-brutal-green" : "border-brutal-red"}`}
            style={{ borderColor: cat.winning ? "#2ECC71" : "#E74C3C" }}
          >
            <div className="text-xs font-black uppercase text-muted mb-2">
              {cat.name}
            </div>
            <div className="flex justify-between items-end">
              <div
                className={`text-xl font-black ${cat.winning ? "text-brutal-green" : ""}`}
              >
                {cat.name === "FG%" || cat.name === "FT%"
                  ? (cat.mine * 100).toFixed(1) + "%"
                  : cat.mine}
              </div>
              <div
                className={`text-xl font-black ${!cat.winning ? "text-brutal-red" : ""}`}
              >
                {cat.name === "FG%" || cat.name === "FT%"
                  ? (cat.theirs * 100).toFixed(1) + "%"
                  : cat.theirs}
              </div>
            </div>
            <div className="flex justify-between text-xs font-bold text-muted mt-1">
              <span>ME</span>
              <span>OPP</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-sm text-muted font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  );
}
