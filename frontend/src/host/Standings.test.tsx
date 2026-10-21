import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gameInfo, hostStatus } from '../test/host'
import { teams } from './core'
import Standings from './Standings'

const list = teams(gameInfo(), hostStatus())

describe('Standings', () => {
  it('renders nothing before a round is resolved', () => {
    const { container } = render(<Standings standings={[]} list={list} />)
    expect(container.firstChild).toBeNull()
  })

  it('keeps the engine order and numbers the places', () => {
    render(
      <Standings
        standings={[
          ['usa', 6000],
          ['russia', 4567],
        ]}
        list={list}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[0].textContent).toBe('1США60.00 %')
    expect(rows[1].textContent).toBe('2Россия45.67 %')
  })

  it('shows the raw id of a country missing from the list', () => {
    render(<Standings standings={[['atlantis', 100]]} list={list} />)
    expect(screen.getByText('atlantis')).toBeTruthy()
  })
})
