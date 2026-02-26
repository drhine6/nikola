import { v } from "convex/values";
import { internalAction } from "./_generated/server";

const BALLDONTLIE_BASE = "https://www.balldontlie.io/api/v1";

async function fetchJson(path: string, params: Record<string, string | number | undefined>) {
  const url = new URL(`${BALLDONTLIE_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`balldontlie request failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return await res.json();
}

export const fetchGamesRange = internalAction({
  args: {
    startDate: v.string(),
    endDate: v.string(),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    return await fetchJson("/games", {
      start_date: args.startDate,
      end_date: args.endDate,
      per_page: args.perPage ?? 100,
    });
  },
});

export const fetchGameStats = internalAction({
  args: {
    gameIds: v.array(v.string()),
    perPage: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const url = new URL(`${BALLDONTLIE_BASE}/stats`);
    url.searchParams.set("per_page", String(args.perPage ?? 100));
    for (const gameId of args.gameIds) {
      url.searchParams.append("game_ids[]", gameId);
    }
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`balldontlie stats request failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return await res.json();
  },
});

export const fetchSeasonAverages = internalAction({
  args: {
    season: v.number(),
    playerIds: v.array(v.string()),
  },
  handler: async (_ctx, args) => {
    const url = new URL(`${BALLDONTLIE_BASE}/season_averages`);
    url.searchParams.set("season", String(args.season));
    for (const playerId of args.playerIds) {
      url.searchParams.append("player_ids[]", playerId);
    }
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`balldontlie season averages request failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return await res.json();
  },
});
