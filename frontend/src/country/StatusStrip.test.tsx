import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { foreign, me, ownCity } from '../test/observation'
import { money } from './format'
import StatusStrip from './StatusStrip'

describe('StatusStrip', () => {
  it('shows the key numbers with my place among all visible countries', () => {
    const { container } = render(<StatusStrip me={me()} ecology={72} others={[foreign()]} />)
    const text = container.querySelector('.statusbar')?.textContent ?? ''
    expect(text).toContain(money(1200)) // 1 200 $, narrow no-break spaces
    expect(text).toContain('45.67 %') // average life, mine
    expect(text).toContain('2 из 2') // the USA (60 %) is better — silver place
    expect(screen.getByAltText('2 место')).toBeTruthy()
    expect(text).toContain('1 из 1') // cities: alive of all
    expect(text).toContain('72 %') // world ecology
  })

  it('shows the income forecast only when the engine sent one (#11)', () => {
    const { container, rerender } = render(
      <StatusStrip me={me()} ecology={72} others={[foreign()]} />,
    )
    expect(container.textContent).not.toContain('Доход')

    rerender(<StatusStrip me={me()} ecology={72} others={[foreign()]} forecast={615} />)
    const text = container.querySelector('.statusbar')?.textContent ?? ''
    expect(text).toContain('Доход ≈')
    expect(text).toContain(money(615))
  })

  it('medals the first place, silver stays second', () => {
    const { rerender } = render(
      <StatusStrip me={me({ average_life_level: 9000 })} ecology={72} others={[foreign()]} />,
    )
    expect(screen.getByAltText('1 место')).toBeTruthy()

    rerender(
      <StatusStrip me={me({ average_life_level: 5000 })} ecology={72} others={[foreign()]} />,
    )
    expect(screen.getByAltText('2 место')).toBeTruthy()
  })

  it('shows no place while the whole field is level: round one, all 0.00 %', () => {
    const { container } = render(
      <StatusStrip
        me={me({ average_life_level: 0 })}
        ecology={72}
        others={[foreign({ average_life_level: 0 })]}
      />,
    )
    const text = container.querySelector('.statusbar')?.textContent ?? ''
    expect(text).toContain('—')
    expect(text).not.toContain('1 из 2')
    expect(screen.queryByAltText(/место/)).toBeNull()
  })

  it.each([
    [72, 'ok'],
    [50, 'warn'],
    [20, 'bad'],
  ])('colours world ecology %i%% as %s', (ecology, tone) => {
    render(<StatusStrip me={me()} ecology={ecology} others={[]} />)
    expect(screen.getByText(`${ecology} %`).className).toBe(tone)
  })

  it('counts destroyed cities as gone', () => {
    const mine = me({
      cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург', destroyed: true })],
    })
    const { container } = render(<StatusStrip me={mine} ecology={72} others={[]} />)
    expect(container.querySelector('.statusbar')?.textContent).toContain('1 из 2')
  })

  it('carries the optional action (the refresh button) at the end', () => {
    render(
      <StatusStrip
        me={me()}
        ecology={72}
        others={[]}
        action={<button type="button">Обновить</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy()
  })
})
