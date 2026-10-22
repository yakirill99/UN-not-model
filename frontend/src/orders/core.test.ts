import { describe, expect, it } from 'vitest'
import { actionSpace, option } from '../test/actions'
import {
  costOf,
  countLeft,
  emptyDraft,
  isEmpty,
  pruneDraft,
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

describe('pruneDraft', () => {
  const blocked = (id: string, reason: string) =>
    actionSpace({
      actions: {
        ...actionSpace().actions,
        [id]: option({ ...actionSpace().actions[id], available: false, reason }),
      },
    })

  it('keeps a draft the rules still allow, object identity included', () => {
    const d = draft({ invest: ['moscow'], shields: ['spb'], aid: { usa: 10 } })
    expect(pruneDraft(d, actionSpace())).toBe(d)
  })

  it('leaves an empty draft alone', () => {
    const d = emptyDraft()
    expect(pruneDraft(d, actionSpace())).toBe(d)
  })

  // The bug from the field: the technology was developed last round, so the engine
  // reports already_owned and the form hides the checkbox — but the tick stayed in
  // the draft, kept charging 500$ and made every submission fail with no way out.
  it('drops a technology that is already owned', () => {
    const d = draft({ nuclear_tech: true, invest: ['moscow'] })
    const pruned = pruneDraft(d, blocked('nuclear_tech', 'already_owned'))
    expect(pruned.nuclear_tech).toBe(false)
    expect(pruned.invest).toEqual(['moscow'])
  })

  it('drops bombs once the engine stops offering them', () => {
    expect(pruneDraft(draft({ bombs: 2 }), blocked('bomb', 'requires_nuclear_tech')).bombs).toBe(0)
  })

  it('drops eco programs when the action goes away', () => {
    expect(
      pruneDraft(draft({ eco_programs: 3 }), blocked('eco_program', 'insufficient_budget'))
        .eco_programs,
    ).toBe(0)
  })

  it.each([
    ['strikes', 'strike'],
    ['shields', 'shield'],
    ['sanctions', 'sanction'],
  ] as const)('drops %s when the action is unavailable', (key, id) => {
    const d = draft({ [key]: ['moscow'] } as Partial<Draft>)
    expect(pruneDraft(d, blocked(id, 'no_targets'))[key]).toEqual([])
  })

  it('drops aid when the action is unavailable', () => {
    expect(pruneDraft(draft({ aid: { usa: 50 } }), blocked('aid', 'no_targets')).aid).toEqual({})
  })

  // A city destroyed last round disappears from targets: the pick must go with it.
  it('drops a target the rules no longer list, keeping the rest', () => {
    const space = actionSpace({
      actions: {
        ...actionSpace().actions,
        invest: option({ ...actionSpace().actions.invest, targets: ['moscow'] }),
      },
    })
    expect(pruneDraft(draft({ invest: ['moscow', 'spb', 'moscow'] }), space).invest).toEqual([
      'moscow',
      'moscow',
    ])
  })

  it('drops a recipient the rules no longer list', () => {
    const space = actionSpace({
      actions: {
        ...actionSpace().actions,
        aid: option({ ...actionSpace().actions.aid, targets: ['france'] }),
      },
    })
    expect(pruneDraft(draft({ aid: { usa: 50, france: 20 } }), space).aid).toEqual({ france: 20 })
  })

  it('keeps every recipient when aid is untargeted', () => {
    const space = actionSpace({
      actions: {
        ...actionSpace().actions,
        aid: option({ ...actionSpace().actions.aid, targets: null }),
      },
    })
    expect(pruneDraft(draft({ aid: { usa: 50 } }), space).aid).toEqual({ usa: 50 })
  })

  it('keeps every target when the action is untargeted', () => {
    const space = actionSpace({
      actions: {
        ...actionSpace().actions,
        shield: option({ ...actionSpace().actions.shield, targets: null }),
      },
    })
    expect(pruneDraft(draft({ shields: ['moscow'] }), space).shields).toEqual(['moscow'])
  })

  it('empties a draft whose actions all went away', () => {
    const none = actionSpace({
      actions: Object.fromEntries(
        Object.entries(actionSpace().actions).map(([id, o]) => [
          id,
          option({ ...o, available: false, reason: 'insufficient_budget' }),
        ]),
      ),
    })
    const d = draft({ invest: ['moscow'], nuclear_tech: true, bombs: 1, aid: { usa: 5 } })
    expect(isEmpty(pruneDraft(d, none))).toBe(true)
  })

  it('treats an action the rules never defined as unavailable', () => {
    const space = actionSpace()
    delete (space.actions as Record<string, unknown>).nuclear_tech
    expect(pruneDraft(draft({ nuclear_tech: true }), space).nuclear_tech).toBe(false)
  })
})
