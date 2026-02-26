import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "./test.setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stats actions", () => {
  it("fetchGamesRange calls balldontlie with date window", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/api/v1/games");
      expect(url.searchParams.get("start_date")).toBe("2026-02-26");
      expect(url.searchParams.get("end_date")).toBe("2026-03-04");
      expect(url.searchParams.get("per_page")).toBe("50");
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules as any);
    const result = await t.action(internal.stats.fetchGamesRange, {
      startDate: "2026-02-26",
      endDate: "2026-03-04",
      perPage: 50,
    });

    expect(result).toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
