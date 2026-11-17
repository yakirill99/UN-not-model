import { describe, expect, it } from 'vitest'
import { mergeNews, plural, times } from './merge'
import { describeGroup } from './news'
import type { AnyEvent } from './news'

const base = { round: 4, schema_version: 1, actor: null, target: null }
const ev = <T extends AnyEvent['type']>(type: T, rest: object): AnyEvent =>
  ({ ...base, type, ...rest }) as AnyEvent

const NAMES = { spb: 'Санкт-Петербург', moscow: 'Москва', usa: 'США', bot: 'Ботвания' }

describe('mergeNews', () => {
  it('folds a bot investing three times into one story', () => {
    const groups = mergeNews([
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('city_invested', {
        actor: 'bot',
        target: 'moscow',
        development_before: 40,
        development_after: 55,
      }),
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 70,
        development_after: 85,
      }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].events).toHaveLength(3)
  })

  it('keeps different countries apart: two bots investing are two stories', () => {
    const groups = mergeNews([
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('city_invested', {
        actor: 'usa',
        target: 'moscow',
        development_before: 40,
        development_after: 55,
      }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('never merges across rounds', () => {
    const groups = mergeNews([
      ev('city_invested', {
        round: 3,
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('city_invested', {
        round: 4,
        actor: 'bot',
        target: 'spb',
        development_before: 70,
        development_after: 80,
      }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('keeps strikes on different cities apart, folds the same-target ones', () => {
    const groups = mergeNews([
      ev('nuclear_strike', { target: 'spb', outcome: 'absorbed' }),
      ev('nuclear_strike', { target: 'moscow', outcome: 'absorbed' }),
      ev('nuclear_strike', { target: 'spb', outcome: 'destroyed' }),
    ])
    expect(groups).toHaveLength(3)
  })

  it('keeps the order of first mention', () => {
    const groups = mergeNews([
      ev('tech_developed', { actor: 'usa', tech: 'nuclear' }),
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('shield_built', { actor: 'usa', target: 'moscow' }),
      ev('city_invested', {
        actor: 'bot',
        target: 'moscow',
        development_before: 40,
        development_after: 55,
      }),
    ])
    expect(groups.map((g) => g.events[0].type)).toEqual([
      'tech_developed',
      'city_invested',
      'shield_built',
    ])
  })

  it('keeps unmergeable events as they are', () => {
    const groups = mergeNews([
      ev('city_destroyed', { target: 'spb', cause: 'nuclear_strike' }),
      ev('city_destroyed', { target: 'moscow', cause: 'nuclear_strike' }),
      ev('laugh_awarded', { target: 'usa', bonus: 5, laugh_after: 5 }),
      ev('round_ended', { budget_after: 900, bombs_released: 0, aid_credited: 0 }),
    ])
    expect(groups).toHaveLength(4)
  })
})

describe('describeGroup · merged wording', () => {
  it('folds three investments into one city: before → after plus the count', () => {
    const [group] = mergeNews([
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 70,
        development_after: 80,
      }),
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 80,
        development_after: 95,
      }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Развитие города выросло с 60 % до 95 % (3 хода)')
  })

  it('folds investments into different cities: one line, cities listed', () => {
    const [group] = mergeNews([
      ev('city_invested', {
        actor: 'bot',
        target: 'spb',
        development_before: 60,
        development_after: 70,
      }),
      ev('city_invested', {
        actor: 'bot',
        target: 'moscow',
        development_before: 40,
        development_after: 55,
      }),
    ])
    expect(describeGroup(group, NAMES)).toBe(
      'Развитие городов (2): Санкт-Петербург 60 % → 70 %, Москва 40 % → 55 %',
    )
  })

  it('sums aid payments in one direction', () => {
    const [group] = mergeNews([
      ev('aid_transferred', { actor: 'usa', target: 'bot', amount: 200 }),
      ev('aid_transferred', { actor: 'usa', target: 'bot', amount: 300 }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Помощь 500 $: США → Ботвания (2 платежа)')
  })

  it('sums incoming aid for the player too', () => {
    const [group] = mergeNews([
      ev('aid_transferred', { target: 'bot', amount: 100 }),
      ev('aid_transferred', { target: 'bot', amount: 150 }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Получена помощь 250 $ (2 платежа)')
  })

  it('sums bomb orders and keeps the last pending count', () => {
    const [group] = mergeNews([
      ev('bombs_produced', { actor: 'bot', count: 2, bombs_pending_after: 3 }),
      ev('bombs_produced', { actor: 'bot', count: 1, bombs_pending_after: 4 }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Произведено бомб: 3 (всего в работе 4, 2 приказа)')
  })

  it('sums sanctions of the same pair', () => {
    const [group] = mergeNews([
      ev('sanction_applied', { actor: 'usa', target: 'bot', delta: 5 }),
      ev('sanction_applied', { actor: 'usa', target: 'bot', delta: 10 }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Санкции от США → Ботвания: развитие −15 (2 санкции)')
  })

  it('sums one cause of ecology change and shows the final value', () => {
    const [group] = mergeNews([
      ev('ecology_changed', { cause: 'eco_program', delta: 10, ecology_after: 80 }),
      ev('ecology_changed', { cause: 'eco_program', delta: 5, ecology_after: 85 }),
    ])
    expect(describeGroup(group, NAMES)).toBe(
      'Экология +15 → 85 % (экологическая программа, 2 события)',
    )
  })

  it('lists the cities under shields', () => {
    const [group] = mergeNews([
      ev('shield_built', { actor: 'bot', target: 'spb' }),
      ev('shield_built', { actor: 'bot', target: 'moscow' }),
    ])
    expect(describeGroup(group, NAMES)).toBe(
      'Построены щиты над городами: Санкт-Петербург, Москва (2)',
    )
  })

  it('counts off a repeated strike with the same target and outcome', () => {
    const [group] = mergeNews([
      ev('nuclear_strike', { target: 'spb', outcome: 'absorbed' }),
      ev('nuclear_strike', { target: 'spb', outcome: 'absorbed' }),
    ])
    expect(describeGroup(group, NAMES)).toBe(
      'Нанесён ядерный удар по Санкт-Петербург: щит поглотил удар (×2)',
    )
  })

  it('reads a single event exactly as describeEvent does', () => {
    const [group] = mergeNews([
      ev('city_invested', { target: 'spb', development_before: 60, development_after: 70 }),
    ])
    expect(describeGroup(group, NAMES)).toBe('Развитие города выросло с 60 % до 70 %')
  })
})

describe('plural and times', () => {
  it('declines counts the way Russian reads', () => {
    expect(plural(1, 'ход', 'хода', 'ходов')).toBe('1 ход')
    expect(plural(2, 'ход', 'хода', 'ходов')).toBe('2 хода')
    expect(plural(5, 'ход', 'хода', 'ходов')).toBe('5 ходов')
    expect(plural(11, 'ход', 'хода', 'ходов')).toBe('11 ходов')
    expect(plural(21, 'ход', 'хода', 'ходов')).toBe('21 ход')
    expect(plural(22, 'ход', 'хода', 'ходов')).toBe('22 хода')
  })

  it('adds the multiplier only from two on', () => {
    expect(times(1)).toBe('')
    expect(times(3)).toBe(' (×3)')
  })
})
