import { convexTest } from 'convex-test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../convex/_generated/api'
import schema from '../../convex/schema'
import { modules } from './test.setup'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('queries.getCurrentMatchup', () => {
  it('prefers current matchup period and hydrates myTeam/opponent from TEAM_ID', async () => {
    vi.stubEnv('TEAM_ID', '2')
    vi.stubEnv('ESPN_LEAGUE_ID', '12345')
    vi.stubEnv('ESPN_SEASON', '2026')

    const t = convexTest(schema, modules as any)

    await t.run(async (ctx) => {
      await ctx.db.insert('leagues', {
        leagueKey: '12345:2026',
        espnLeagueId: '12345',
        season: 2026,
        name: 'Nikola',
        currentMatchupPeriodId: 18,
        scoringSettings: {
          statSettings: {
            '0': { name: 'Points' },
            '6': { name: 'Rebounds' },
            '13': { name: 'Field Goals Made' },
            '15': { name: 'Free Throws Made' },
            '16': { name: 'Free Throws Attempted' },
            '20': { name: 'Free Throw Percentage' },
            '22': { name: 'Adjusted Field Goal Percentage' },
            '44': { name: 'Double Doubles' },
          },
        },
        updatedAt: 1,
      })

      await ctx.db.insert('teams', {
        leagueKey: '12345:2026',
        espnTeamId: 2,
        // Simulate placeholder ESPN name so query falls back to matchup raw fields.
        name: 'Team2',
        ownerDisplayNames: ['Me'],
        wins: 10,
        losses: 7,
        ties: 0,
        standingRank: 4,
        updatedAt: 1,
      })
      await ctx.db.insert('teams', {
        leagueKey: '12345:2026',
        espnTeamId: 6,
        name: 'Team 6',
        ownerDisplayNames: ['Them'],
        wins: 11,
        losses: 6,
        ties: 0,
        standingRank: 2,
        updatedAt: 1,
      })

      await ctx.db.insert('matchups', {
        matchupKey: '12345:2026:18:6:2',
        leagueKey: '12345:2026',
        matchupPeriodId: 18,
        homeTeamId: 6,
        awayTeamId: 2,
        homeScore: 0,
        awayScore: 0,
        categories: {
          home: {
            wins: 5,
            losses: 4,
            ties: 0,
            scoreByStat: {
              '0': { score: 480, result: 'WIN' },
              '6': { score: 200, result: 'LOSS' },
              '13': { score: 48.7, result: 'WIN' },
              '15': { score: 35, result: 'WIN' },
              '16': { score: 43, result: 'WIN' },
              '20': { score: 0.81395349, result: 'WIN' },
              '22': { score: 0.42692308, result: 'LOSS' },
              '44': { score: 3, result: 'WIN' },
              '37': { score: 2, result: 'WIN' },
              '42': { score: 9, result: 'WIN' },
            },
          },
          away: {
            wins: 4,
            losses: 5,
            ties: 0,
            scoreByStat: {
              '0': { score: 455, result: 'LOSS' },
              '6': { score: 215, result: 'WIN' },
              '13': { score: 47.2, result: 'LOSS' },
              '15': { score: 17, result: 'LOSS' },
              '16': { score: 25, result: 'LOSS' },
              '20': { score: 0.68, result: 'LOSS' },
              '22': { score: 0.61881188, result: 'WIN' },
              '44': { score: 2, result: 'LOSS' },
              '37': { score: 0, result: 'LOSS' },
              '42': { score: 8, result: 'LOSS' },
            },
          },
        },
        raw: {
          home: { teamName: 'Free Strahinja' },
          away: { teamName: "AR's Herd of GOATs" },
        },
        updatedAt: 1,
      })

      // Future matchup should not be selected
      await ctx.db.insert('matchups', {
        matchupKey: '12345:2026:20:2:7',
        leagueKey: '12345:2026',
        matchupPeriodId: 20,
        homeTeamId: 2,
        awayTeamId: 7,
        homeScore: 0,
        awayScore: 0,
        updatedAt: 1,
      })
    })

    const matchup = await t.query(api.queries.getCurrentMatchup, {})

    expect(matchup).toMatchObject({
      matchupPeriodId: 18,
      myTeamId: 2,
      myTeamIsHome: false,
      myScore: 4,
      opponentScore: 5,
      myTeam: { name: "AR's Herd of GOATs" },
      opponent: { name: 'Free Strahinja' },
      currentMatchupPeriodId: 18,
    })
    expect((matchup as any).matchupScoreSummary).toMatchObject({
      myWins: 4,
      myLosses: 5,
      myTies: 0,
      opponentWins: 5,
      opponentLosses: 4,
      opponentTies: 0,
    })

    expect((matchup as any).categoryBreakdown).toMatchObject([
      { statId: '0', name: 'PTS', mine: 455, theirs: 480, winning: false },
      { statId: '6', name: 'REB', mine: 215, theirs: 200, winning: true },
      { statId: '20', name: 'FT%', winning: false },
      { statId: '22', name: 'AFG%', winning: true },
      { statId: '44', name: 'DD', mine: 2, theirs: 3, winning: false },
    ])
    const statIds = (matchup as any).categoryBreakdown.map((row: any) => row.statId)
    expect(statIds).not.toContain('13')
    expect(statIds).not.toContain('15')
    expect(statIds).not.toContain('16')
    expect((matchup as any).categoryBreakdown.find((r: any) => r.statId === '20')?.mine).toBeCloseTo(0.68, 6)
    expect((matchup as any).categoryBreakdown.find((r: any) => r.statId === '20')?.theirs).toBeCloseTo(0.81395349, 6)
    expect((matchup as any).categoryBreakdown.find((r: any) => r.statId === '22')?.mine).toBeCloseTo(0.61881188, 6)
    expect((matchup as any).categoryBreakdown.find((r: any) => r.statId === '22')?.theirs).toBeCloseTo(0.42692308, 6)
    expect((matchup as any).metaBreakdown).toEqual([
      { statId: '37', name: 'MATCHUP ACQ', mine: 0, theirs: 2, winning: false },
      { statId: '42', name: 'GAMES PLAYED', mine: 8, theirs: 9, winning: false },
    ])
    expect((matchup as any).debugMatchupStats).toMatchObject({
      homeScoreByStatKeys: expect.arrayContaining(['44']),
      awayScoreByStatKeys: expect.arrayContaining(['44']),
      visibleStatIds: expect.arrayContaining(['44']),
      metaStatIds: ['37', '42'],
    })
  })
})
