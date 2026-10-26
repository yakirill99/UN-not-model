import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Changes, { changes } from './Changes'
import type { AnyEvent } from './news'

const base = { round: 2, schema_version: 1, actor: null, target: null }
const ev = <T extends AnyEvent['type']>(type: T, rest: object): AnyEvent =>
  ({ ...base, type, ...rest }) as AnyEvent

describe('changes', () => {
  it('puts the bad news first and keeps the engine order inside a group', () => {
    const list = changes([
      ev('income_credited', { amount: 300, budget_after: 1500 }),
      ev('nuclear_strike', { target: 'moscow', outcome: 'destroyed' }),
      ev('city_destroyed', { target: 'spb', cause: 'nuclear' }),
      ev('shield_built', { target: 'moscow' }),
    ])
    expect(list.map((c) => c.event.type)).toEqual([
      'nuclear_strike',
      'city_destroyed',
      'shield_built',
      'income_credited',
    ])
    expect(list.map((c) => c.tone)).toEqual(['bad', 'bad', 'ok', 'ok'])
  })

  it('leaves neutral changes untoned: spending is neither good nor bad', () => {
    const list = changes([ev('bombs_produced', { count: 1, bombs_pending_after: 1 })])
    expect(list).toHaveLength(1)
    expect(list[0].tone).toBeNull()
    expect(list[0].icon).toBe('🧨')
  })

  it('skips the life level recalculation — nothing the player watches has moved', () => {
    const list = changes([
      ev('income_credited', { amount: 300, budget_after: 1500 }),
      ev('life_level_computed', { life_level: 4567 }),
    ])
    expect(list).toHaveLength(1)
    expect(list[0].event.type).toBe('income_credited')
  })
})

describe('Changes', () => {
  it('renders nothing when there is no news', () => {
    const { container } = render(<Changes news={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when the news is only bookkeeping', () => {
    const { container } = render(
      <Changes news={[ev('life_level_computed', { life_level: 4567 })]} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows the strike on top, toned and worded like the news below', () => {
    render(
      <Changes
        news={[
          ev('income_credited', { amount: 300, budget_after: 1500 }),
          ev('nuclear_strike', { target: 'moscow', outcome: 'destroyed' }),
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(items[0].className).toBe('bad')
    expect(items[0].textContent).toContain('удар по moscow')
    expect(items[1].className).toBe('ok')
    expect(screen.getByText('Что изменилось за раунд')).toBeTruthy()
  })
})
