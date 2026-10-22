import { describe, expect, it } from 'vitest'
import { city, country, event, gameLog, playedLog, record, state } from '../test/log'
import {
  allEvents,
  averageLife,
  deeds,
  ecologyLine,
  eventsOfRound,
  last,
  lifeLines,
  names,
  rounds,
  scale,
  standings,
} from './core'

describe('rounds / names', () => {
  it('reads an unplayed game as zero rounds', () => {
    expect(rounds(gameLog())).toEqual([])
    expect(rounds(gameLog({ rounds: undefined }))).toEqual([])
  })

  it('maps both countries and cities to their names', () => {
    const map = names(playedLog())
    expect(map.russia).toBe('Россия')
    expect(map['russia-1']).toBe('Москва')
  })
})

describe('averageLife', () => {
  // The engine divides by all cities, not the surviving ones: a destroyed city
  // drags the average down with its zero (state.py, average_life_level).
  it('counts a destroyed city as a zero', () => {
    const c = country({
      id: 'usa',
      cities: [city({ id: 'a', life_level: 8000 }), city({ id: 'b', life_level: 0 })],
    })
    expect(averageLife(c)).toBe(40)
  })

  it('converts hundredths of a percent to percent', () => {
    expect(averageLife(country({ id: 'x', cities: [city({ id: 'a', life_level: 4567 })] }))).toBe(
      45.67,
    )
  })

  it('survives a country with no cities instead of dividing by zero', () => {
    expect(averageLife({ ...country({ id: 'ghost' }), cities: [] })).toBe(0)
  })
})

describe('ecologyLine', () => {
  it('starts at round 0 so the fall from 100 % is visible', () => {
    expect(ecologyLine(playedLog())).toEqual([
      { round: 0, value: 100 },
      { round: 1, value: 85 },
      { round: 2, value: 70 },
    ])
  })

  it('is a single point before the first round is resolved', () => {
    expect(ecologyLine(gameLog())).toEqual([{ round: 0, value: 100 }])
  })
})

describe('lifeLines', () => {
  it('follows every country from the start of the game', () => {
    const [russia, usa] = lifeLines(playedLog())
    expect(russia.name).toBe('Россия')
    expect(russia.points.map((p) => p.value)).toEqual([50, 55, 60])
    expect(last(usa.points)).toBe(25)
  })

  it('reports zero for a country missing from a later state', () => {
    const log = gameLog({
      rounds: [record({ round: 1, state_after: state({ countries: [country({ id: 'usa' })] }) })],
    })
    expect(lifeLines(log)[0].points.map((p) => p.value)).toEqual([50, 0])
  })
})

describe('standings', () => {
  it('sorts by the final score, best first', () => {
    expect(standings(playedLog()).map((s) => s.id)).toEqual(['russia', 'usa'])
  })

  it('leaves the source order untouched', () => {
    const log = playedLog()
    standings(log)
    expect(lifeLines(log).map((s) => s.id)).toEqual(['russia', 'usa'])
  })
})

describe('deeds', () => {
  it('counts the actions, busiest first', () => {
    expect(deeds(allEvents(playedLog()))).toEqual([
      { id: 'city_invested', label: 'Инвестиции', count: 1 },
      { id: 'ecology_changed', label: 'Экопрограммы', count: 1 },
      { id: 'nuclear_strike', label: 'Удары', count: 1 },
    ])
  })

  // Weapons emit ecology_changed too; counting those would credit a bomb as
  // an act of conservation.
  it('counts only the ecology changes that helped', () => {
    const events = [
      event({ type: 'ecology_changed', cause: 'bomb_production', delta: -5, ecology_after: 95 }),
      event({ type: 'ecology_changed', cause: 'eco_program', delta: 30, ecology_after: 100 }),
    ]
    expect(deeds(events)).toEqual([{ id: 'ecology_changed', label: 'Экопрограммы', count: 1 }])
  })

  it('ignores the bookkeeping events', () => {
    const events = [
      event({ type: 'budget_spent', action: 'invest', amount: 150, budget_after: 10 }),
      event({ type: 'income_credited', amount: 200, budget_after: 210 }),
      event({ type: 'round_ended', budget_after: 1, bombs_released: 0, aid_credited: 0 }),
    ]
    expect(deeds(events)).toEqual([])
  })

  it('breaks a tie by id, so the order never jitters', () => {
    const events = [
      event({ type: 'shield_built', target: 'moscow' }),
      event({ type: 'bombs_produced', count: 1, bombs_pending_after: 1 }),
    ]
    expect(deeds(events).map((s) => s.id)).toEqual(['bombs_produced', 'shield_built'])
  })

  it('is empty for an empty game', () => {
    expect(deeds([])).toEqual([])
  })
})

describe('eventsOfRound', () => {
  it('returns one round', () => {
    expect(eventsOfRound(playedLog(), 2)).toHaveLength(3)
  })

  it('returns the whole game for null', () => {
    expect(eventsOfRound(playedLog(), null)).toHaveLength(6)
  })

  it('returns nothing for a round that was never played', () => {
    expect(eventsOfRound(playedLog(), 9)).toEqual([])
  })
})

describe('scale / last', () => {
  it('is the largest value', () => {
    expect(scale([3, 9, 1])).toBe(9)
  })

  it.each([
    ['empty', []],
    ['all zero', [0, 0]],
    ['negative', [-5]],
  ])('never returns zero for %s input', (_name, values) => {
    expect(scale(values)).toBe(1)
  })

  it('reads the last point, or zero without points', () => {
    expect(last([{ round: 1, value: 7 }])).toBe(7)
    expect(last([])).toBe(0)
  })
})
