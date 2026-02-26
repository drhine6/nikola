import { asNumber } from './convex-bridge'

export function toRecordString(team: any) {
  if (!team) return '—'
  const wins = asNumber(team.wins)
  const losses = asNumber(team.losses)
  const ties = asNumber(team.ties)
  return `${wins}-${losses}-${ties}`
}

export function normalizeCategoryBreakdown(raw: any, matchup: any) {
  const myTeamIsHome = Boolean(matchup?.myTeamIsHome)

  const getEntryScore = (entry: any) =>
    asNumber(entry?.score ?? entry?.value ?? entry?.statScore ?? entry?.displayValue ?? entry)

  if (raw?.home && raw?.away) {
    const homeStats = raw.home?.scoreByStat ?? raw.home
    const awayStats = raw.away?.scoreByStat ?? raw.away

    if (
      homeStats &&
      awayStats &&
      typeof homeStats === 'object' &&
      typeof awayStats === 'object'
    ) {
      const keys = Array.from(new Set([...Object.keys(homeStats), ...Object.keys(awayStats)])).filter(
        (key) => !['_id', 'wins', 'losses', 'ties'].includes(key),
      )

      const rows = keys
        .map((key) => {
          const homeValue = homeStats[key]
          const awayValue = awayStats[key]
          const homeScore = getEntryScore(homeValue)
          const awayScore = getEntryScore(awayValue)
          if (homeScore === 0 && awayScore === 0) {
            const bothMissing =
              homeValue == null ||
              (typeof homeValue === 'object' && getEntryScore(homeValue) === 0 && homeValue.score == null && homeValue.value == null)
            const awayMissing =
              awayValue == null ||
              (typeof awayValue === 'object' && getEntryScore(awayValue) === 0 && awayValue.score == null && awayValue.value == null)
            if (bothMissing && awayMissing) return null
          }

          const mine = myTeamIsHome ? homeScore : awayScore
          const theirs = myTeamIsHome ? awayScore : homeScore
          const normalizedKey = key.toUpperCase()
          const isTurnovers = normalizedKey === 'TO' || normalizedKey === 'TURNOVERS'
          return {
            name: normalizedKey,
            mine,
            theirs,
            winning: isTurnovers ? mine < theirs : mine > theirs,
          }
        })
        .filter(Boolean) as Array<{ name: string; mine: number; theirs: number; winning: boolean }>

      if (rows.length > 0) return rows
    }

    const homeWins = asNumber(raw.home?.wins)
    const homeLosses = asNumber(raw.home?.losses)
    const homeTies = asNumber(raw.home?.ties)
    const awayWins = asNumber(raw.away?.wins)
    const awayLosses = asNumber(raw.away?.losses)
    const awayTies = asNumber(raw.away?.ties)
    const summaryHasData =
      [homeWins, homeLosses, homeTies, awayWins, awayLosses, awayTies].some((n) => n !== 0)

    if (summaryHasData) {
      const mineWins = myTeamIsHome ? homeWins : awayWins
      const oppWins = myTeamIsHome ? awayWins : homeWins
      const mineLosses = myTeamIsHome ? homeLosses : awayLosses
      const oppLosses = myTeamIsHome ? awayLosses : homeLosses
      const mineTies = myTeamIsHome ? homeTies : awayTies
      const oppTies = myTeamIsHome ? awayTies : homeTies

      return [
        { name: 'WINS', mine: mineWins, theirs: oppWins, winning: mineWins > oppWins },
        { name: 'LOSSES', mine: mineLosses, theirs: oppLosses, winning: mineLosses < oppLosses },
        { name: 'TIES', mine: mineTies, theirs: oppTies, winning: mineTies > oppTies },
      ]
    }
  }

  if (Array.isArray(raw)) {
    return raw.map((cat: any) => ({
      name: String(cat.name ?? cat.stat ?? 'CAT'),
      mine: asNumber(cat.mine ?? cat.home ?? cat.myScore),
      theirs: asNumber(cat.theirs ?? cat.away ?? cat.opponentScore),
      winning: Boolean(cat.winning),
    }))
  }

  if (raw && typeof raw === 'object') {
    const entries = Object.entries(raw)
      .filter(([, value]) => value && typeof value === 'object')
      .slice(0, 9)
      .map(([name, value]: [string, any]) => {
        const mine = asNumber(value.home ?? value.mine ?? value.value ?? 0)
        const theirs = asNumber(value.away ?? value.theirs ?? value.opponent ?? 0)
        const turnovers = name.toUpperCase() === 'TO'
        return {
          name: name.toUpperCase(),
          mine,
          theirs,
          winning: turnovers ? mine < theirs : mine > theirs,
        }
      })
    if (entries.length > 0) return entries
  }

  return [
    {
      name: 'TOTAL',
      mine: asNumber(matchup?.myScore ?? matchup?.homeScore),
      theirs: asNumber(matchup?.opponentScore ?? matchup?.awayScore),
      winning:
        asNumber(matchup?.myScore ?? matchup?.homeScore) >=
        asNumber(matchup?.opponentScore ?? matchup?.awayScore),
    },
  ]
}
