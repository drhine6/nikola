import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "./test.setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("espn actions", () => {
  it("fetchLeagueViews sends auth cookies and view params", async () => {
    vi.stubEnv("ESPN_S2", "s2-cookie");
    vi.stubEnv("ESPN_SWID", "{SWID}");
    vi.stubEnv("ESPN_LEAGUE_ID", "12345");
    vi.stubEnv("ESPN_SEASON", "2026");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("/games/fba/seasons/2026/segments/0/leagues/12345");
      expect(url).toContain("view=mRoster");
      expect(url).toContain("view=mStandings");
      expect(init?.headers).toMatchObject({
        Accept: "application/json",
        Cookie: "espn_s2=s2-cookie; SWID={SWID}",
      });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules as any);
    const result = await t.action(internal.espn.fetchLeagueViews, {
      views: ["mRoster", "mStandings"],
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reports auth failures clearly", async () => {
    vi.stubEnv("ESPN_S2", "expired");
    vi.stubEnv("ESPN_SWID", "{SWID}");
    vi.stubEnv("ESPN_LEAGUE_ID", "12345");
    vi.stubEnv("ESPN_SEASON", "2026");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Forbidden", { status: 403 })),
    );

    const t = convexTest(schema, modules as any);
    await expect(
      t.action(internal.espn.fetchLeagueViews, { views: ["mRoster"] }),
    ).rejects.toThrowError(/Auth cookies may be expired/i);
  });
});
