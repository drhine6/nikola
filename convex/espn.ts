import { v } from "convex/values";
import { internalAction } from "./_generated/server";

type EspnView =
  | "mRoster"
  | "mMatchup"
  | "mBoxscore"
  | "mStandings"
  | "mSettings"
  | "mTeam"
  | "mStatus"
  | "mFreeAgents";

function requiredEnv(name: string, fallback?: string) {
  const value =
    process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(
      `Missing Convex environment variable: ${name}${fallback ? ` (or ${fallback})` : ""}`
    );
  }
  return value;
}

function baseLeagueUrl() {
  const season = requiredEnv("ESPN_SEASON", "LEAGUE_YEAR");
  const leagueId = requiredEnv("ESPN_LEAGUE_ID", "LEAGUE_ID");
  return `https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/${season}/segments/0/leagues/${leagueId}`;
}

function authCookieHeader() {
  const espnS2 = requiredEnv("ESPN_S2");
  const swid = process.env.ESPN_SWID ?? process.env.SWID;
  if (!swid) {
    throw new Error("Missing Convex environment variable: ESPN_SWID (or SWID)");
  }
  return `espn_s2=${espnS2}; SWID=${swid}`;
}

export const fetchLeagueViews = internalAction({
  args: {
    views: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    const url = new URL(baseLeagueUrl());
    for (const view of args.views as EspnView[]) {
      url.searchParams.append("view", view);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Cookie: authCookieHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ESPN request failed (${response.status}). ${response.status === 401 || response.status === 403 ? "Auth cookies may be expired. " : ""}${text.slice(0, 500)}`
      );
    }

    return await response.json();
  },
});

export const fetchFreeAgents = internalAction({
  args: {
    size: v.optional(v.number()),
    from: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const url = new URL(baseLeagueUrl());
    url.searchParams.append("view", "mFreeAgents");
    if (typeof args.size === "number") {
      url.searchParams.append("size", String(args.size));
    }
    if (typeof args.from === "number") {
      url.searchParams.append("from", String(args.from));
    }

    const response = await fetch(url.toString(), {
      headers: {
        Cookie: authCookieHeader(),
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `ESPN free agents request failed (${response.status}): ${text.slice(0, 500)}`
      );
    }

    return await response.json();
  },
});
