import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Schemas } from '../api/client'
import Ticker from './Ticker'

type AnyEvent = NonNullable<Schemas['Observation']['news']>[number]

const ev = (type: string, rest: object): AnyEvent =>
  ({ round: 3, schema_version: 1, actor: null, target: null, type, ...rest }) as AnyEvent

const NAMES = { spb: 'Санкт-Петербург', usa: 'США', iran: 'Иран' }

describe('Ticker', () => {
  it('renders nothing on a quiet round', () => {
    const { container } = render(<Ticker news={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('crawls the round news in one line, worst first, with human names', () => {
    const news = [
      ev('income_credited', { amount: 615, budget_after: 2000 }),
      ev('nuclear_strike', { actor: null, target: 'spb', outcome: 'destroyed' }),
      ev('sanction_applied', { actor: 'usa', target: 'iran', delta: 10 }),
    ]
    render(<Ticker news={news} names={NAMES} />)
    const line = screen.getByRole('status', { name: 'События раунда бегущей строкой' })
    const text = line.textContent ?? ''
    expect(text).toContain('Санкт-Петербург')
    expect(text).toContain('Санкции от США → Иран')
    // The strike leads: what hurts comes first.
    expect(text.indexOf('удар')).toBeLessThan(text.indexOf('Санкции'))
  })

  it('duplicates the content for a seamless loop and hides the copy from readers', () => {
    const news = [ev('laugh_awarded', { actor: null, target: 'russia', bonus: 5, laugh_after: 5 })]
    render(<Ticker news={news} names={NAMES} />)
    const halves = document.querySelectorAll('.ticker-half')
    expect(halves).toHaveLength(2)
    expect(halves[1].getAttribute('aria-hidden')).toBe('true')
  })
})
