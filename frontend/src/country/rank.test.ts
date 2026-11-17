import { describe, expect, it } from 'vitest'
import { foreign, me } from '../test/observation'
import { allEqual, medalPlace, rankOf } from './rank'

describe('medalPlace', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, null],
    [17, null],
  ])('place %i -> %s', (place, medal) => {
    expect(medalPlace(place)).toBe(medal)
  })
})

describe('allEqual', () => {
  it('is true while nobody differs: round one, everyone at 0.00 %', () => {
    expect(allEqual([0, 0, 0, 0])).toBe(true)
  })

  it('is false once someone pulls ahead', () => {
    expect(allEqual([0, 0, 1])).toBe(false)
  })

  it('a lone country has nothing to compare', () => {
    expect(allEqual([4567])).toBe(true)
  })

  it('an empty field has no places to argue about', () => {
    expect(allEqual([])).toBe(true)
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
