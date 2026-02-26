import { describe, expect, it } from 'vitest'
import { normalizeCategoryBreakdown } from '../../frontend/src/lib/matchup'

describe('normalizeCategoryBreakdown', () => {
  it('renders W/L/T summary cards when only cumulative matchup category totals exist', () => {
    const rows = normalizeCategoryBreakdown(
      {
        home: { wins: 2, losses: 0, ties: 0 },
        away: { wins: 0, losses: 2, ties: 0 },
      },
      { myTeamIsHome: false, myScore: 0, opponentScore: 2 },
    )

    expect(rows).toEqual([
      { name: 'WINS', mine: 0, theirs: 2, winning: false },
      { name: 'LOSSES', mine: 2, theirs: 0, winning: false },
      { name: 'TIES', mine: 0, theirs: 0, winning: false },
    ])
  })

  it('parses per-category scoreByStat when available', () => {
    const rows = normalizeCategoryBreakdown(
      {
        home: { scoreByStat: { pts: 500, reb: 200, turnovers: 60 } },
        away: { scoreByStat: { pts: 450, reb: 220, turnovers: 55 } },
      },
      { myTeamIsHome: true },
    )

    expect(rows).toEqual([
      { name: 'PTS', mine: 500, theirs: 450, winning: true },
      { name: 'REB', mine: 200, theirs: 220, winning: false },
      { name: 'TURNOVERS', mine: 60, theirs: 55, winning: false },
    ])
  })

  it('parses ESPN object-style scoreByStat entries with score/result fields', () => {
    const rows = normalizeCategoryBreakdown(
      {
        home: {
          scoreByStat: {
            '0': { score: 500, result: 'WIN' },
            '6': { score: 200, result: 'LOSS' },
            '13': { score: 48.7, result: 'WIN' },
          },
        },
        away: {
          scoreByStat: {
            '0': { score: 450, result: 'LOSS' },
            '6': { score: 220, result: 'WIN' },
            '13': { score: 47.2, result: 'LOSS' },
          },
        },
      },
      { myTeamIsHome: true },
    )

    expect(rows).toEqual([
      { name: '0', mine: 500, theirs: 450, winning: true },
      { name: '6', mine: 200, theirs: 220, winning: false },
      { name: '13', mine: 48.7, theirs: 47.2, winning: true },
    ])
  })
})
