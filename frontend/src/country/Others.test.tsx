import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { foreign } from '../test/observation'
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
})
