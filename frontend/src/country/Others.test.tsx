import { render, screen, within } from '@testing-library/react'
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
    expect(screen.getByText('Городов целы: 1 из 2')).toBeTruthy()
    // The chart carries the number now.
    const chart = screen.getByRole('img', { name: 'Рейтинг стран по среднему уровню жизни' })
    expect(within(chart).getByText('60.00 %')).toBeTruthy()
  })

  it('breaks foreign countries into cities with life levels and ruins (#7)', () => {
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
    const chips = document.querySelector('.city-chips') as HTMLElement
    expect(chips).toBeTruthy()
    expect(chips.textContent).toContain('Нью-Йорк · 60.00 %')
    expect(chips.textContent).toContain('Лос-Анджелес — разрушен')
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

  it('ranks as a bar chart, best first, ties by name (#2)', () => {
    render(
      <Others
        others={[
          foreign({ average_life_level: 3000 }),
          foreign({ id: 'iran', name: 'Иран', average_life_level: 6000 }),
          foreign({ id: 'brazil', name: 'Бразилия', average_life_level: 3000 }),
        ]}
      />,
    )
    const chart = screen.getByRole('img', { name: 'Рейтинг стран по среднему уровню жизни' })
    const names = [...chart.querySelectorAll('.bar-name')].map((el) => el.textContent)
    expect(names).toEqual(['1. Иран', '2. Бразилия', '2. США'])
    expect(screen.getByAltText('1 место')).toBeTruthy()
    expect(screen.getAllByAltText('2 место')).toHaveLength(2)
    // The leader's bar fills the whole track, the rest are visibly shorter.
    const fills = [...chart.querySelectorAll<HTMLElement>('.bar-fill')]
    expect(fills[0].style.width).toBe('100%')
    expect(parseFloat(fills[1].style.width)).toBeLessThan(100)
  })

  it('hides places entirely while the whole field is level — round one, all 0.00 %', () => {
    render(
      <Others
        others={[
          foreign({ average_life_level: 0 }),
          foreign({ id: 'iran', name: 'Иран', average_life_level: 0 }),
        ]}
      />,
    )
    const chart = screen.getByRole('img', { name: 'Рейтинг стран по среднему уровню жизни' })
    const names = [...chart.querySelectorAll('.bar-name')].map((el) => el.textContent)
    expect(names).toEqual(['— Иран', '— США'])
    expect(screen.queryByAltText(/место/)).toBeNull()
  })

  it('counts my own country in the chart as «Вы», but keeps it out of the list', () => {
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
    const chart = screen.getByRole('img', { name: 'Рейтинг стран по среднему уровню жизни' })
    const names = [...chart.querySelectorAll('.bar-name')].map((el) => el.textContent)
    // I lead the chart; the others carry their global places.
    expect(names).toEqual(['1. Вы', '2. США', '3. Иран'])
    expect(screen.getByAltText('2 место')).toBeTruthy()
    expect(screen.getByAltText('3 место')).toBeTruthy()
    // The list below stays foreign-only.
    const list = container.querySelectorAll('.other strong')
    expect([...list].map((el) => el.textContent)).toEqual(['США', 'Иран'])
  })
})
