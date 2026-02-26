import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { modules } from "./test.setup";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sync actions", () => {
  it("runSyncSchedule stores games and logs success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      expect(url).toContain("/api/v1/games");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: 777,
              season: 2026,
              date: "2026-02-26T00:00:00.000Z",
              status: "Final",
              home_team: { abbreviation: "LAL" },
              visitor_team: { abbreviation: "BOS" },
              home_team_score: 110,
              visitor_team_score: 108
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules as any);
    const result = await t.action(internal.sync.runSyncSchedule, {});
    expect(result).toMatchObject({
      status: "success",
      recordCounts: {
        games: { total: 1 },
      },
    });

    const games = await t.run(async (ctx) => await ctx.db.query("games").collect());
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      externalGameId: "777",
      gameDate: "2026-02-26",
      status: "final",
      isActive: false,
      homeTeamAbbr: "LAL",
      awayTeamAbbr: "BOS",
    });

    const syncLog = await t.query(api.queries.getSyncLog, { limit: 5 });
    expect(syncLog[0]).toMatchObject({
      syncType: "syncSchedule",
      status: "success",
    });
  });

  it("runSyncLive skips immediately when no active games are present", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const t = convexTest(schema, modules as any);
    const result = await t.action(internal.sync.runSyncLive, {});
    expect(result).toMatchObject({
      status: "skipped",
      recordCounts: { gamesActive: 0 },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    const syncLog = await t.query(api.queries.getSyncLog, { limit: 1 });
    expect(syncLog[0]).toMatchObject({
      syncType: "syncLive",
      status: "skipped",
    });
  });

  it("runSyncLeague writes league, teams, rosters, matchups, and players", async () => {
    vi.stubEnv("ESPN_S2", "s2-cookie");
    vi.stubEnv("ESPN_SWID", "{SWID}");
    vi.stubEnv("ESPN_LEAGUE_ID", "12345");
    vi.stubEnv("ESPN_SEASON", "2026");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const isBoxscore = url.includes("view=mBoxscore");
        const payload = isBoxscore
          ? {
              id: 12345,
              seasonId: 2026,
              status: { currentMatchupPeriod: 5 },
              teams: [
                {
                  id: 1,
                  name: "Free Strahinja",
                  abbrev: "JOK",
                  rankCalculatedFinal: 1,
                  record: {
                    overall: {
                      wins: 7,
                      losses: 2,
                      ties: 0,
                      pointsFor: 900,
                      pointsAgainst: 800,
                    },
                  },
                },
                {
                  id: 2,
                  name: "AR's Herd of GOATs",
                  abbrev: "Andy",
                  rankCalculatedFinal: 2,
                  record: {
                    overall: {
                      wins: 5,
                      losses: 4,
                      ties: 0,
                      pointsFor: 850,
                      pointsAgainst: 840,
                    },
                  },
                },
              ],
              schedule: [],
              settings: {},
            }
          : {
              id: 12345,
              seasonId: 2026,
              scoringPeriodId: 10,
              status: { currentMatchupPeriod: 5 },
              settings: {
                name: "Nikola Test League",
                scoringSettings: { scoringType: "H2H_POINTS" }
              },
              members: [
                { id: "m1", firstName: "David", lastName: "Rhine" }
              ],
              teams: [
                {
                  id: 1,
                  name: "Team 1",
                  owners: ["m1"],
                  roster: {
                    entries: [
                      {
                        lineupSlotId: 2,
                        acquisitionType: "DRAFT",
                        playerPoolEntry: {
                          player: {
                            id: 42,
                            fullName: "Nikola Jokic",
                            firstName: "Nikola",
                            lastName: "Jokic",
                            eligibleSlots: [2, 3],
                            proTeamId: 8,
                            injuryStatus: "ACTIVE",
                            active: true
                          }
                        }
                      }
                    ]
                  }
                },
                {
                  id: 2,
                  name: "Team2",
                  owners: [],
                  roster: { entries: [] }
                }
              ],
              schedule: [
                {
                  matchupPeriodId: 5,
                  scoringPeriodId: 10,
                  home: { teamId: 1, totalPoints: 50 },
                  away: { teamId: 2, totalPoints: 45 },
                  winner: "HOME"
                }
              ],
              players: [
                {
                  player: {
                    id: 99,
                    fullName: "Free Agent Guy",
                    firstName: "Free",
                    lastName: "Agent",
                    eligibleSlots: [2],
                    proTeamId: 1,
                    injuryStatus: "ACTIVE",
                    active: true
                  }
                }
              ]
            };
        return new Response(
          JSON.stringify(payload),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }),
    );

    const t = convexTest(schema, modules as any);
    const result = await t.action(internal.sync.runSyncLeague, {});
    expect(result).toMatchObject({
      status: "success",
      recordCounts: {
        teams: { total: 2 },
        rosters: { total: 2 },
        matchups: { total: 1 },
        players: { total: 2 }
      }
    });

    const league = await t.query(api.queries.getLeagueConfig, {});
    expect(league).toMatchObject({
      leagueKey: "12345:2026",
      name: "Nikola Test League",
      currentScoringPeriodId: 10,
      currentMatchupPeriodId: 5,
    });

    const standings = await t.query(api.queries.getStandings, {});
    expect(standings).toHaveLength(2);
    expect(standings[0]).toMatchObject({
      espnTeamId: 1,
      name: "Free Strahinja",
      abbrev: "JOK",
      standingRank: 1,
      wins: 7,
      losses: 2,
      ties: 0,
    });
    expect(standings[1]).toMatchObject({
      espnTeamId: 2,
      name: "AR's Herd of GOATs",
      abbrev: "Andy",
      standingRank: 2,
      wins: 5,
      losses: 4,
      ties: 0,
    });

    const freeAgents = await t.query(api.queries.getFreeAgents, { limit: 10 });
    expect(freeAgents).toHaveLength(1);
    expect(freeAgents[0].roster).toMatchObject({
      assignmentType: "free_agent",
      espnPlayerId: 99,
    });
  });
});
