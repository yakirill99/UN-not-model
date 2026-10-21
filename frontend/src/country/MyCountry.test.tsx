import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { me } from '../test/observation'
import MyCountry from './MyCountry'

describe('MyCountry', () => {
  it('shows the secret numbers only the owner may see', () => {
    render(<MyCountry me={me({ budget: 1200, average_life_level: 4567 })} />)
    // RTL normalises the narrow no-break space from money() into a plain space.
    expect(screen.getByText('1 200 $')).toBeTruthy()
    expect(screen.getByText('45.67 %')).toBeTruthy()
  })

  it('hides the laugh row until the country wins the prize', () => {
    const { rerender } = render(<MyCountry me={me({ laugh: 0 })} />)
    expect(screen.queryByText('Коэффициент смеха')).toBeNull()
    rerender(<MyCountry me={me({ laugh: 5 })} />)
    expect(screen.getByText('+5')).toBeTruthy()
  })

  it('reports nuclear tech when the country has it', () => {
    render(<MyCountry me={me({ nuclear_tech: true })} />)
    expect(screen.getByText('есть')).toBeTruthy()
  })

  it('says there is no nuclear tech yet', () => {
    render(<MyCountry me={me({ nuclear_tech: false })} />)
    expect(screen.getByText('нет')).toBeTruthy()
  })

  it('counts only ready bombs when nothing is in production', () => {
    render(<MyCountry me={me({ bombs: 2, bombs_pending: 0 })} />)
    expect(screen.getByText('Бомбы: 2 готовы')).toBeTruthy()
  })

  it('never sums ready bombs with the ones still in production', () => {
    render(<MyCountry me={me({ bombs: 1, bombs_pending: 3 })} />)
    expect(screen.getByText('Бомбы: 1 готовы, ещё 3 будут готовы в следующем раунде')).toBeTruthy()
  })

  it('warns that aid is credited only next round', () => {
    render(<MyCountry me={me({ aid_pending: 500 })} />)
    expect(screen.getByText('Помощь 500 $ зачислится в начале следующего раунда')).toBeTruthy()
  })

  it('names who sanctioned us', () => {
    render(<MyCountry me={me({ sanctioned_by: ['usa', 'france'] })} />)
    expect(screen.getByText('Санкции против нас: usa, france')).toBeTruthy()
  })

  it('omits aid and sanction lines when there are none', () => {
    render(<MyCountry me={me()} />)
    expect(screen.queryByText(/Помощь/)).toBeNull()
    expect(screen.queryByText(/Санкции/)).toBeNull()
  })
})
