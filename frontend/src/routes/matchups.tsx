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

type MatchupRosterRow = {
  roster?: { _id?: string; espnPlayerId?: number; injuryStatus?: string };
  player?: {
    fullName?: string;
    position?: string;
    positions?: string[];
    nbaTeamAbbr?: string;
    injuryStatus?: string;
  };
  stats?: {
    latestGame?: {
      gameDate?: string;
      stats?: Record<string, number | string>;
    };
  };
};

function formatCategoryValue(cat: MatchupCategoryRow, value: number) {
  return cat.name.includes("%") ? `${(value * 100).toFixed(1)}%` : value;
}

function scoreString(wins: number, losses: number, ties: number) {
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
}

function InjuryBadge({ status }: { status: string }) {
  if (!status || status === "ACTIVE") return null;
  const colors: Record<string, string> = {
    DAY_TO_DAY: "bg-brutal-yellow text-brutal-black",
    OUT: "bg-brutal-red text-brutal-white",
    SUSPENSION: "bg-brutal-orange text-brutal-white",
  };
  return (
    <span className={`brutal-tag ${colors[status] || "bg-brutal-gray"}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function computeDailyDd(stats?: Record<string, number | string>) {
  if (!stats) return 0;
  const categories = ["pts", "reb", "ast", "stl", "blk"];
  const doubles = categories.filter((k) => asNumber(stats[k], 0) >= 10).length;
  return doubles >= 2 ? 1 : 0;
}

function RosterPanel({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: MatchupRosterRow[];
  loading?: boolean;
}) {
  return (
    <div className="brutal-card overflow-x-auto">
      <div className="px-4 py-3 border-b-2 border-brutal-black font-black uppercase">
        {title}
      </div>
      <table className="brutal-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>Status</th>
            <th>MIN</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
            <th>STL</th>
            <th>BLK</th>
            <th>3PM</th>
            <th>DD</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={11} className="font-medium text-muted">
                Loading roster...
              </td>
            </tr>
          ) : null}
          {!loading && rows.length === 0 ? (
            <tr>
              <td colSpan={11} className="font-medium text-muted">
                No roster data available.
              </td>
            </tr>
          ) : null}
          {rows.map((row, idx) => {
            const latest = row?.stats?.latestGame;
            const stats = latest?.stats;
            const hasLatest = Boolean(stats);
            const pos =
              row?.player?.position ??
              (Array.isArray(row?.player?.positions)
                ? row.player.positions[0]
                : undefined) ??
              "—";
            const status =
              row?.roster?.injuryStatus ?? row?.player?.injuryStatus ?? "ACTIVE";
            return (
              <tr key={String(row?.roster?._id ?? row?.roster?.espnPlayerId ?? idx)}>
                <td className="font-bold">
                  <div>{row?.player?.fullName ?? `Player ${idx + 1}`}</div>
                  <div className="text-xs font-mono text-muted">
                    {row?.player?.nbaTeamAbbr ?? "—"}
                    {latest?.gameDate ? ` · ${latest.gameDate}` : ""}
                  </div>
                </td>
                <td>
                  <span className="brutal-tag bg-brutal-blue text-brutal-black">
                    {pos}
                  </span>
                </td>
                <td>
                  <InjuryBadge status={status} />
                </td>
                <td className="font-mono">{hasLatest ? (stats?.min ?? "—") : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.pts, 0) : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.reb, 0) : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.ast, 0) : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.stl, 0) : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.blk, 0) : "—"}</td>
                <td className="font-mono">{hasLatest ? asNumber(stats?.fg3m, 0) : "—"}</td>
                <td className="font-mono">
                  {hasLatest ? computeDailyDd(stats) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Matchups() {
  const matchupQuery = useQuery(
    convexQuery(api.queries.getCurrentMatchup, convexArgs({}))
  );
  const syncLogQuery = useQuery(
    convexQuery(api.queries.getSyncLog, convexArgs({ limit: 1 }))
  );
  const matchupRostersQuery = useQuery(
    convexQuery((api as any).queries.getCurrentMatchupRosters, convexArgs({}))
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
  const ties = matchup.scoreSummary?.myTies ?? 0;
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
  const myRosterRows = (((matchupRostersQuery.data as any)?.myRoster ??
    []) as MatchupRosterRow[]);
  const opponentRosterRows = (((matchupRostersQuery.data as any)?.opponentRoster ??
    []) as MatchupRosterRow[]);

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

      {/* Matchup scoreboard */}
      <div className="brutal-card overflow-hidden">
        {/* Score header */}
        <div className="p-6 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xl font-black">{matchup.myTeam.name}</div>
            <div className="text-sm text-muted">{matchup.myTeam.record}</div>
          </div>
          <div className="flex items-center gap-6 px-6">
            <div className="text-5xl font-black tabular-nums">
              {scoreString(myWins, theirWins, ties)}
            </div>
            <div className="text-5xl font-black tabular-nums">
              {scoreString(theirWins, myWins, ties)}
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-xl font-black">{matchup.opponent.name}</div>
            <div className="text-sm text-muted">{matchup.opponent.record}</div>
          </div>
        </div>

        {/* Meta info */}
        {(typeof myGamesPlayed === "number" || typeof myAcq === "number") && (
          <div
            className="px-6 pb-4 flex justify-between text-xs text-muted"
            style={{ marginTop: "-0.5rem" }}
          >
            <div className="space-y-0.5">
              {typeof myGamesPlayed === "number" && (
                <div>
                  <span className="font-bold">Game Limits (Cur/Max):</span>{" "}
                  {myGamesPlayed}/25 games played
                </div>
              )}
              {typeof myAcq === "number" && (
                <div>
                  <span className="font-bold">
                    Matchup Acquisition Limit (Used/Max):
                  </span>{" "}
                  {myAcq} / 7
                </div>
              )}
            </div>
            <div className="space-y-0.5 text-right">
              {typeof oppGamesPlayed === "number" && (
                <div>
                  <span className="font-bold">Game Limits (Cur/Max):</span>{" "}
                  {oppGamesPlayed}/25 games played
                </div>
              )}
              {typeof oppAcq === "number" && (
                <div>
                  <span className="font-bold">
                    Matchup Acquisition Limit (Used/Max):
                  </span>{" "}
                  {oppAcq} / 7
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  borderTop: "2px solid var(--brutal-border)",
                  borderBottom: "2px solid var(--brutal-border)",
                }}
              >
                <th className="px-4 py-2 text-left text-xs font-bold uppercase text-muted">
                  Team
                </th>
                {(matchup.categories as MatchupCategoryRow[]).map((cat) => (
                  <th
                    key={cat.name}
                    className="px-3 py-2 text-right text-xs font-bold uppercase text-muted"
                  >
                    {cat.name}
                  </th>
                ))}
                <th className="px-3 py-2 text-right text-xs font-bold uppercase text-muted">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                style={{
                  borderBottom: "1px solid var(--brutal-border)",
                }}
              >
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                  {matchup.myTeam.name}
                </td>
                {(matchup.categories as MatchupCategoryRow[]).map((cat) => (
                  <td
                    key={cat.name}
                    className={`px-3 py-3 font-mono text-sm text-right ${cat.winning ? "bg-brutal-green/75" : ""}`}
                  >
                    {formatCategoryValue(cat, cat.mine)}
                  </td>
                ))}
                <td className="px-3 py-3 font-bold text-sm text-right">
                  {scoreString(myWins, theirWins, ties)}
                </td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                  {matchup.opponent.name}
                </td>
                {(matchup.categories as MatchupCategoryRow[]).map((cat) => (
                  <td
                    key={cat.name}
                    className={`px-3 py-3 font-mono text-sm text-right ${!cat.winning ? "bg-brutal-green/75" : ""}`}
                  >
                    {formatCategoryValue(cat, cat.theirs)}
                  </td>
                ))}
                <td className="px-3 py-3 font-bold text-sm text-right">
                  {scoreString(theirWins, myWins, ties)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {isConvexEnabled && matchupRostersQuery.error ? (
        <div className="brutal-card p-4 mt-4 border-brutal-red">
          <div className="font-bold text-brutal-red">
            Failed to load matchup rosters
          </div>
          <div className="text-sm">{matchupRostersQuery.error.message}</div>
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RosterPanel
          title={`${matchup.myTeam.name} Roster (Daily Stats)`}
          rows={myRosterRows}
          loading={Boolean(isConvexEnabled && matchupRostersQuery.isLoading)}
        />
        <RosterPanel
          title={`${matchup.opponent.name} Roster (Daily Stats)`}
          rows={opponentRosterRows}
          loading={Boolean(isConvexEnabled && matchupRostersQuery.isLoading)}
        />
      </div>

      <div className="mt-4 text-sm text-muted font-medium">
        Last synced: <span className="font-mono">{lastSyncedLabel}</span>
      </div>
    </div>
  );
}
