import { describe, expect, it } from 'vitest'
import { actionSpace, option } from '../test/actions'
import {
  costOf,
  countLeft,
  emptyDraft,
  isEmpty,
  reasonText,
  toBody,
  totalCost,
  usedCount,
  type Draft,
} from './core'

const draft = (over: Partial<Draft> = {}): Draft => ({ ...emptyDraft(), ...over })

describe('emptyDraft / isEmpty', () => {
  it('starts empty', () => {
    expect(isEmpty(emptyDraft())).toBe(true)
  })

  it.each([
    ['invest', draft({ invest: ['moscow'] })],
    ['eco_programs', draft({ eco_programs: 1 })],
    ['nuclear_tech', draft({ nuclear_tech: true })],
    ['bombs', draft({ bombs: 1 })],
    ['strikes', draft({ strikes: ['nyc'] })],
    ['shields', draft({ shields: ['moscow'] })],
    ['sanctions', draft({ sanctions: ['usa'] })],
    ['aid', draft({ aid: { usa: 100 } })],
  ])('%s alone makes it non-empty', (_name, d) => {
    expect(isEmpty(d)).toBe(false)
  })
})

describe('toBody', () => {
  it('hands the draft over unchanged — it is a CountryOrders already', () => {
    const d = draft({ invest: ['moscow'], aid: { usa: 10 } })
    expect(toBody(d)).toEqual(d)
  })
})

describe('costOf', () => {
  it('reads the price out of the action space', () => {
    expect(costOf(actionSpace(), 'invest')).toBe(150)
  })

  it('is free when the rules omit the action', () => {
    expect(costOf(actionSpace(), 'teleport')).toBe(0)
  })
})

describe('totalCost', () => {
  const space = actionSpace()

  it('is zero for an empty draft', () => {
    expect(totalCost(emptyDraft(), space)).toBe(0)
  })

  it('counts a repeated investment per unit', () => {
    expect(totalCost(draft({ invest: ['moscow', 'moscow', 'spb'] }), space)).toBe(450)
  })

  it('sums every priced action', () => {
    const d = draft({
      invest: ['moscow'],
      eco_programs: 2,
      nuclear_tech: true,
      bombs: 2,
      shields: ['spb'],
      aid: { usa: 50 },
    })
    expect(totalCost(d, space)).toBe(150 + 400 + 500 + 300 + 300 + 50)
  })

  it('leaves strikes and sanctions free, as the rules do', () => {
    expect(totalCost(draft({ strikes: ['nyc'], sanctions: ['usa'] }), space)).toBe(0)
  })
})

describe('usedCount', () => {
  const d = draft({
    invest: ['moscow', 'spb'],
    eco_programs: 3,
    nuclear_tech: true,
    bombs: 2,
    strikes: ['nyc'],
    shields: ['moscow'],
    sanctions: ['usa'],
    aid: { usa: 10 },
  })

  it.each([
    ['invest', 2],
    ['eco_program', 3],
    ['nuclear_tech', 1],
    ['bomb', 2],
    ['strike', 1],
    ['shield', 1],
    ['sanction', 1],
    ['aid', 1],
  ])('counts %s', (id, expected) => {
    expect(usedCount(d, id)).toBe(expected)
  })

  it('counts nuclear_tech as zero while it is off', () => {
    expect(usedCount(emptyDraft(), 'nuclear_tech')).toBe(0)
  })
})

describe('countLeft', () => {
  it('is unlimited when the rules set no max_count', () => {
    expect(countLeft(option({ id: 'invest' }), 5)).toBeNull()
  })

  it('counts down to the limit', () => {
    expect(countLeft(option({ id: 'bomb', max_count: 3 }), 1)).toBe(2)
  })

  it('never goes below zero', () => {
    expect(countLeft(option({ id: 'bomb', max_count: 3 }), 5)).toBe(0)
  })
})

describe('reasonText', () => {
  it('translates the engine codes', () => {
    expect(reasonText('no_bombs')).toBe('нет готовых бомб')
    expect(reasonText('over_budget')).toBe('на все приказы не хватает бюджета')
  })

  it('passes an unknown code through', () => {
    expect(reasonText('brand_new_reason')).toBe('brand_new_reason')
  })

  it('falls back when the engine sent no reason', () => {
    expect(reasonText(null)).toBe('недоступно')
    expect(reasonText(undefined)).toBe('недоступно')
  })
})
