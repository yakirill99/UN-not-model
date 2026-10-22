import { describe, expect, it } from 'vitest'
import { event, playedLog } from '../test/log'
import { names } from './core'
import { feed, filterKinds, KINDS, type Kind } from './feed'

const NAMES = { russia: 'Россия', usa: 'США', 'usa-1': 'Вашингтон', 'russia-1': 'Москва' }
const line = (e: ReturnType<typeof event>) => feed([e], NAMES)[0]

describe('feed', () => {
  it('reads newest first, so the latest round is on top of the screen', () => {
    const entries = feed(
      [
        event({ type: 'tech_developed', actor: 'russia', round: 1, tech: 'nuclear' }),
        event({ type: 'shield_built', target: 'russia-1', round: 2 }),
      ],
      NAMES,
    )
    expect(entries.map((e) => e.round)).toEqual([2, 1])
  })

  it('gives every entry a stable key', () => {
    const entries = feed(playedLog().rounds![1].events, NAMES)
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length)
  })

  it('leaves out the bookkeeping nobody needs on a projector', () => {
    const noise = [
      event({
        type: 'budget_spent',
        actor: 'russia',
        action: 'invest',
        amount: 150,
        budget_after: 1,
      }),
      event({ type: 'income_credited', actor: 'russia', amount: 200, budget_after: 201 }),
      event({ type: 'life_level_computed', actor: 'russia', life_level: 5000 }),
      event({ type: 'order_rejected', actor: 'russia', action: 'strike', reason: 'no_bombs' }),
      // One per country per round: it would bury the events that matter.
      event({
        type: 'round_ended',
        actor: 'russia',
        budget_after: 1,
        bombs_released: 0,
        aid_credited: 0,
      }),
    ]
    expect(feed(noise, NAMES)).toEqual([])
  })

  // A v2 rule set may add events this build has never heard of: skip, never crash.
  it('ignores an event type it has no words for', () => {
    const unknown = { ...event({ type: 'shield_built' }), type: 'teleportation_invented' }
    expect(feed([unknown as never], NAMES)).toEqual([])
  })
})

describe('feed · what the room may learn', () => {
  // The whole game turns on not knowing who struck. The host's /events names the
  // actor; this feed goes on a projector, so it must not.
  it('never names the author of a strike', () => {
    const e = line(
      event({ type: 'nuclear_strike', actor: 'russia', target: 'usa-1', outcome: 'destroyed' }),
    )
    expect(e.text).toBe('Ядерный удар по Вашингтон: город разрушен')
    expect(e.text).not.toContain('Россия')
  })

  it.each([
    ['absorbed', 'щит поглотил удар'],
    ['destroyed', 'город разрушен'],
    ['already_destroyed', 'город уже был разрушен'],
  ] as const)('tells the outcome %s', (outcome, expected) => {
    expect(line(event({ type: 'nuclear_strike', target: 'usa-1', outcome })).text).toContain(
      expected,
    )
  })

  it('names the destroyed city without naming the attacker', () => {
    const e = line(
      event({ type: 'city_destroyed', actor: 'russia', target: 'usa-1', cause: 'nuclear_strike' }),
    )
    expect(e.text).toBe('Город Вашингтон разрушен')
  })

  // Sanctions are public by the rules — the victim is told who imposed them.
  it('names the country that imposed sanctions, because the rules make it public', () => {
    const e = line(event({ type: 'sanction_applied', actor: 'usa', target: 'russia', delta: 5 }))
    expect(e.text).toBe('США ввела санкции против Россия: развитие −5')
  })

  it('names both sides of an aid transfer', () => {
    const e = line(event({ type: 'aid_transferred', actor: 'usa', target: 'russia', amount: 300 }))
    expect(e.text).toContain('США')
    expect(e.text).toContain('Россия')
  })
})

describe('feed · wording', () => {
  it.each([
    [
      { type: 'city_invested', target: 'russia-1', development_before: 60, development_after: 75 },
      'Москва: развитие 60 % → 75 %',
    ],
    [
      { type: 'tech_developed', actor: 'russia', tech: 'nuclear' },
      'Россия освоила ядерную технологию',
    ],
    [
      { type: 'bombs_produced', actor: 'russia', count: 2, bombs_pending_after: 2 },
      'Россия произвела бомб: 2',
    ],
    [{ type: 'shield_built', target: 'russia-1' }, 'Москва под ядерным щитом'],
    [
      { type: 'laugh_awarded', target: 'russia', bonus: 20, laugh_after: 20 },
      'Приз за юмор: Россия',
    ],
  ])('describes %o', (payload, expected) => {
    expect(line(event(payload as never)).text).toBe(expected)
  })

  it('shows the sign and the cause of an ecology change', () => {
    const down = line(
      event({ type: 'ecology_changed', cause: 'bomb_production', delta: -15, ecology_after: 85 }),
    )
    expect(down).toMatchObject({ icon: '☁️', text: 'Экология -15 → 85 %' })

    const up = line(
      event({ type: 'ecology_changed', cause: 'eco_program', delta: 30, ecology_after: 100 }),
    )
    expect(up).toMatchObject({ icon: '♻️', text: 'Экология +30 → 100 %' })
  })

  it('falls back to the raw id when a name is unknown', () => {
    expect(line(event({ type: 'shield_built', target: 'atlantis' })).text).toBe(
      'atlantis под ядерным щитом',
    )
  })

  it('writes a dash rather than inventing a name for a missing actor', () => {
    expect(line(event({ type: 'tech_developed', actor: null, tech: 'nuclear' })).text).toBe(
      '— освоила ядерную технологию',
    )
  })
})

describe('filterKinds', () => {
  const entries = feed(
    [
      event({
        type: 'city_invested',
        target: 'russia-1',
        development_before: 60,
        development_after: 75,
      }),
      event({ type: 'nuclear_strike', target: 'usa-1', outcome: 'destroyed' }),
      event({ type: 'aid_transferred', actor: 'usa', target: 'russia', amount: 10 }),
    ],
    NAMES,
  )

  it('keeps everything when nothing is selected', () => {
    expect(filterKinds(entries, new Set())).toHaveLength(3)
  })

  it.each([
    ['build', 1],
    ['war', 1],
    ['deal', 1],
    ['eco', 0],
  ] as const)('keeps only %s', (kind, expected) => {
    expect(filterKinds(entries, new Set<Kind>([kind]))).toHaveLength(expected)
  })

  it('combines several kinds', () => {
    expect(filterKinds(entries, new Set<Kind>(['build', 'war']))).toHaveLength(2)
  })
})

describe('KINDS', () => {
  it('covers every kind the feed can produce', () => {
    const produced = new Set(
      feed(
        playedLog().rounds!.flatMap((r) => r.events),
        names(playedLog()),
      ).map((e) => e.kind),
    )
    for (const kind of produced) expect(KINDS.map((k) => k.id)).toContain(kind)
  })
})
