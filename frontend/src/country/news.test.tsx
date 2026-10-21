import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import News from './News'
import { describeEvent as say, type AnyEvent } from './news'

const base = { round: 2, schema_version: 1, actor: null, target: null }
const ev = <T extends AnyEvent['type']>(type: T, rest: object): AnyEvent =>
  ({ ...base, type, ...rest }) as AnyEvent

describe('describeEvent', () => {
  it.each([
    [
      ev('order_rejected', { action: 'strike', reason: 'no_bombs' }),
      /Приказ «strike» отклонён: no_bombs/,
    ],
    [
      ev('budget_spent', { action: 'invest', amount: 150, budget_after: 1050 }),
      /Потрачено 150 \$ на «invest»/,
    ],
    [ev('city_invested', { development_before: 70, development_after: 80 }), /с 70 % до 80 %/],
    [
      ev('ecology_changed', { delta: -5, ecology_after: 67, cause: 'strike' }),
      /Экология -5 → 67 %/,
    ],
    [ev('life_level_computed', { life_level: 4567 }), /45.67 %/],
    [ev('income_credited', { amount: 300, budget_after: 1500 }), /Доход 300 \$/],
    [ev('tech_developed', { tech: 'nuclear' }), /Освоена технология: nuclear/],
    [ev('shield_built', { target: 'moscow' }), /щит над городом moscow/],
    [ev('bombs_produced', { count: 2, bombs_pending_after: 3 }), /Произведено бомб: 2/],
    [ev('city_destroyed', { target: 'nyc', cause: 'nuclear' }), /Город nyc разрушен/],
    [ev('sanction_applied', { target: 'iran', delta: 10 }), /Санкции против iran: развитие −10/],
    [ev('laugh_awarded', { target: 'russia', bonus: 5, laugh_after: 5 }), /Приз за юмор: russia/],
    [
      ev('round_ended', {
        budget_after: 900,
        bombs_released: 1,
        aid_credited: 200,
        sanctions_lifted: 0,
      }),
      /Раунд завершён/,
    ],
  ])('renders %#', (event, expected) => {
    expect(say(event)).toMatch(expected)
  })

  it('shows a positive ecology delta with a plus sign', () => {
    expect(
      say(ev('ecology_changed', { delta: 4, ecology_after: 76, cause: 'eco_program' })),
    ).toMatch(/Экология \+4/)
  })

  it('names the donor when aid is public, stays vague otherwise', () => {
    expect(say(ev('aid_transferred', { actor: 'usa', target: 'iran', amount: 500 }))).toMatch(
      /usa → iran/,
    )
    expect(say(ev('aid_transferred', { amount: 500 }))).toBe('Получена помощь 500 $')
  })

  it.each([
    ['absorbed', /щит поглотил удар/],
    ['destroyed', /город разрушен/],
    ['already_destroyed', /город уже был разрушен/],
  ])('describes a strike outcome: %s', (outcome, expected) => {
    expect(say(ev('nuclear_strike', { target: 'moscow', outcome }))).toMatch(expected)
  })

  it('hides the attacker when the engine withheld it', () => {
    expect(say(ev('nuclear_strike', { target: 'moscow', outcome: 'destroyed' }))).toMatch(
      /^Нанесён ядерный удар/,
    )
    expect(
      say(ev('nuclear_strike', { actor: 'dprk', target: 'moscow', outcome: 'destroyed' })),
    ).toMatch(/^dprk нанёс/)
  })
})

describe('News', () => {
  it('says the round is still quiet', () => {
    render(<News news={[]} />)
    expect(screen.getByText('Пока ничего не произошло.')).toBeTruthy()
  })

  it('lists every event', () => {
    render(
      <News
        news={[ev('tech_developed', { tech: 'nuclear' }), ev('shield_built', { target: 'moscow' })]}
      />,
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })
})
