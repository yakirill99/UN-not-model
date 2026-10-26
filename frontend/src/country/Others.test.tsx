import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { foreign, me } from '../test/observation'
import Others from './Others'

describe('Others', () => {
  it('renders nothing when the player is alone', () => {
    const { container } = render(<Others others={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows only public facts: life level and surviving cities', () => {
    render(
      <Others
        others={[
          foreign({
            cities: [
              { id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6000 },
              { id: 'la', name: 'Лос-Анджелес', destroyed: true, life_level: 0 },
            ],
          }),
        ]}
      />,
    )
    expect(screen.getByText('США')).toBeTruthy()
    expect(screen.getByText('60.00 %')).toBeTruthy()
    expect(screen.getByText('Городов целы: 1 из 2')).toBeTruthy()
  })

  it('mentions the laugh bonus only when the country has one', () => {
    const { rerender } = render(<Others others={[foreign({ laugh: 0 })]} />)
    expect(screen.queryByText(/смех/)).toBeNull()
    rerender(<Others others={[foreign({ laugh: 7 })]} />)
    expect(screen.getByText(/смех \+7/)).toBeTruthy()
  })

  it('lists every country', () => {
    render(<Others others={[foreign(), foreign({ id: 'iran', name: 'Иран' })]} />)
    expect(screen.getByText('США')).toBeTruthy()
    expect(screen.getByText('Иран')).toBeTruthy()
  })

  it('sorts by average life, best first, ties by name', () => {
    const { container } = render(
      <Others
        others={[
          foreign({ average_life_level: 3000 }),
          foreign({ id: 'iran', name: 'Иран', average_life_level: 6000 }),
          foreign({ id: 'brazil', name: 'Бразилия', average_life_level: 3000 }),
        ]}
      />,
    )
    const names = [...container.querySelectorAll('.other strong')].map((el) => el.textContent)
    expect(names).toEqual(['1. Иран 🥇', '2. Бразилия 🥈', '2. США 🥈'])
  })

  it('counts my own country in the ranking but does not list it', () => {
    const mine = me({ average_life_level: 7000 })
    const { container } = render(
      <Others
        others={[
          foreign({ average_life_level: 6000 }),
          foreign({ id: 'iran', name: 'Иран', average_life_level: 5000 }),
        ]}
        me={mine}
      />,
    )
    // Everyone drops one place: I am first, so the USA shows its global place 2.
    const names = [...container.querySelectorAll('.other strong')].map((el) => el.textContent)
    expect(names).toEqual(['2. США 🥈', '3. Иран 🥉'])
    expect(container.textContent).not.toContain('Россия')
  })
})
