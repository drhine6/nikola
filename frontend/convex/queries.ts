import { query } from './_generated/server'

/**
 * Stub query functions — these will return real data once the Convex backend
 * is deployed and syncing from ESPN. For now, the frontend uses mock data inline.
 *
 * Wire these up by replacing mock data in route components with:
 *   const data = useSuspenseQuery(convexQuery(api.queries.getMyRoster, {}))
 */

export const getMyRoster = query({
  handler: async (ctx) => {
    const myTeam = await ctx.db
      .query('teams')
      .filter((q) => q.eq(q.field('isMyTeam'), true))
      .first()
    if (!myTeam) return { team: null, players: [] }

    const players = await ctx.db
      .query('players')
      .filter((q) => q.eq(q.field('teamId'), myTeam._id))
      .collect()

    return { team: myTeam, players }
  },
})

export const getCurrentMatchup = query({
  handler: async (ctx) => {
    // Get the most recent matchup week
    const matchups = await ctx.db.query('matchups').order('desc').take(10)
    if (matchups.length === 0) return null

    const currentWeek = matchups[0].week
    const weekMatchups = matchups.filter((m) => m.week === currentWeek)

    // Find the matchup involving my team
    const myTeam = await ctx.db
      .query('teams')
      .filter((q) => q.eq(q.field('isMyTeam'), true))
      .first()
    if (!myTeam) return null

    const myMatchup = weekMatchups.find(
      (m) => m.homeTeamId === myTeam._id || m.awayTeamId === myTeam._id,
    )
    if (!myMatchup) return null

    const opponentId =
      myMatchup.homeTeamId === myTeam._id ? myMatchup.awayTeamId : myMatchup.homeTeamId
    const opponent = await ctx.db.get(opponentId)

    return {
      week: currentWeek,
      myTeam,
      opponent,
      myScore: myMatchup.homeTeamId === myTeam._id ? myMatchup.homeScore : myMatchup.awayScore,
      opponentScore: myMatchup.homeTeamId === myTeam._id ? myMatchup.awayScore : myMatchup.homeScore,
    }
  },
})

export const getStandings = query({
  handler: async (ctx) => {
    const teams = await ctx.db.query('teams').collect()
    return teams.sort((a, b) => {
      const aWinPct = a.wins / (a.wins + a.losses + a.ties || 1)
      const bWinPct = b.wins / (b.wins + b.losses + b.ties || 1)
      return bWinPct - aWinPct
    })
  },
})

export const getFreeAgents = query({
  handler: async (ctx) => {
    const freeAgents = await ctx.db
      .query('players')
      .filter((q) => q.eq(q.field('isFreeAgent'), true))
      .collect()
    return freeAgents.sort((a, b) => b.stats.ppg - a.stats.ppg)
  },
})

export const getSyncLog = query({
  handler: async (ctx) => {
    return await ctx.db.query('syncLog').order('desc').take(50)
  },
})

export const getLeagueConfig = query({
  handler: async () => {
    return {
      gameLimit: 25,
      acquisitionLimit: 7,
      categories: ['PTS', 'REB', 'AST', 'STL', 'BLK', '3PM', 'FG%', 'FT%', 'TO'],
      scoringType: 'H2H Categories',
    }
  },
})
