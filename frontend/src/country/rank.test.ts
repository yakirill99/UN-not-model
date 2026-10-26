import { describe, expect, it } from 'vitest'
import { foreign, me } from '../test/observation'
import { medalFor, rankOf } from './rank'

describe('medalFor', () => {
  it.each([
    [1, '🥇'],
    [2, '🥈'],
    [3, '🥉'],
    [4, ''],
    [17, ''],
  ])('place %i -> %s', (place, medal) => {
    expect(medalFor(place)).toBe(medal)
  })
})

describe('rankOf', () => {
  it('counts the countries that are strictly better', () => {
    const mine = me({ average_life_level: 5000 })
    const others = [foreign(), foreign({ id: 'iran', name: 'Иран', average_life_level: 4000 })]
    expect(rankOf(mine, others)).toEqual({ place: 2, total: 3 })
  })

  it('gives the top place when nobody is better', () => {
    const mine = me({ average_life_level: 9000 })
    expect(rankOf(mine, [foreign()])).toEqual({ place: 1, total: 2 })
  })

  it('shares the first place on a tie: equal is not better', () => {
    const mine = me({ average_life_level: 6000 }) // the USA fixture has 6000 too
    expect(rankOf(mine, [foreign()])).toEqual({ place: 1, total: 2 })
  })

  it('is last when everybody is better', () => {
    const mine = me({ average_life_level: 100 })
    const others = [foreign(), foreign({ id: 'iran', name: 'Иран', average_life_level: 4000 })]
    expect(rankOf(mine, others)).toEqual({ place: 3, total: 3 })
  })
})
