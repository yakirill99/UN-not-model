import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gameInfo, hostStatus, player } from '../test/host'
import { teams } from './core'
import Standings from './Standings'

const list = teams(gameInfo(), hostStatus())

describe('Standings', () => {
  it('renders nothing before a round is resolved', () => {
    const { container } = render(<Standings standings={[]} list={list} />)
    expect(container.firstChild).toBeNull()
  })

  it('keeps the engine order, medals the top three and numbers the places', () => {
    const four = teams(
      gameInfo({
        players: [
          player({ country_id: 'russia', name: 'Россия', join_code: 'RUS-L75WVG', joined: true }),
          player({ country_id: 'usa', name: 'США', join_code: 'USA-N4FTJ7', joined: false }),
          player({ country_id: 'iran', name: 'Иран' }),
          player({ country_id: 'brazil', name: 'Бразилия' }),
        ],
      }),
      hostStatus(),
    )
    render(
      <Standings
        standings={[
          ['usa', 6000],
          ['russia', 4567],
          ['iran', 3000],
          ['brazil', 2000],
        ]}
        list={four}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[0].textContent).toBe('🥇 1США60.00 %')
    expect(rows[1].textContent).toBe('🥈 2Россия45.67 %')
    expect(rows[2].textContent).toBe('🥉 3Иран30.00 %')
    expect(rows[3].textContent).toBe('4Бразилия20.00 %')
  })

  it('shows the raw id of a country missing from the list', () => {
    render(<Standings standings={[['atlantis', 100]]} list={list} />)
    expect(screen.getByText('atlantis')).toBeTruthy()
  })
})
