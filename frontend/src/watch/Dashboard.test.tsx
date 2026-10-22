import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { event, gameLog, playedLog, record } from '../test/log'
import Dashboard from './Dashboard'

const feedItems = () => {
  const list = document.querySelector('.feed')
  return list ? [...list.querySelectorAll('li')].map((li) => li.textContent ?? '') : []
}
const chip = (name: string | RegExp) => screen.getByRole('button', { name })

describe('Dashboard before the first round', () => {
  it('explains that there is nothing to draw yet', () => {
    render(<Dashboard log={gameLog()} />)
    expect(screen.getByText(/диаграммы появятся после первого подведения итогов/)).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('Dashboard', () => {
  const show = () => render(<Dashboard log={playedLog()} />)

  it('leads with the scoreboard and the standings', () => {
    show()
    expect(screen.getByRole('heading', { name: 'Уровень жизни стран' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Уровень жизни стран' })).toBeTruthy()
    const legend = screen.getAllByRole('list')[0]
    expect(within(legend).getAllByRole('listitem')[0].textContent).toBe('Россия60.0 %')
  })

  it('draws the ecology of the world with its warning', () => {
    show()
    expect(screen.getByRole('img', { name: 'Экология мира' })).toBeTruthy()
    expect(screen.getByText(/Ниже 40 % планета в беде/)).toBeTruthy()
  })

  it('shows the whole game by default', () => {
    show()
    expect(screen.getByText(/вся игра · 5/)).toBeTruthy()
    expect(feedItems()).toHaveLength(5)
  })

  it('counts the deeds of the game', () => {
    show()
    expect(screen.getByText('Инвестиции')).toBeTruthy()
    expect(screen.getByText('Удары')).toBeTruthy()
  })
})

describe('Dashboard · filtering', () => {
  const show = () => render(<Dashboard log={playedLog()} />)

  it('narrows the feed to one round', async () => {
    show()
    await userEvent.click(chip('Раунд 2'))
    expect(screen.getByText(/раунд 2 · 3/)).toBeTruthy()
    expect(feedItems().every((t) => t.includes('2'))).toBe(true)
  })

  it('goes back to the whole game', async () => {
    show()
    await userEvent.click(chip('Раунд 1'))
    await userEvent.click(chip('Вся игра'))
    expect(screen.getByText(/вся игра · 5/)).toBeTruthy()
  })

  it('offers a chip per played round and no more', () => {
    show()
    expect(screen.queryByRole('button', { name: 'Раунд 3' })).toBeNull()
  })

  it('filters by kind', async () => {
    show()
    await userEvent.click(chip('Оружие'))
    expect(feedItems().every((t) => t.includes('Ядерный удар') || t.includes('разрушен'))).toBe(
      true,
    )
  })

  it('combines kinds, and clears them by clicking again', async () => {
    show()
    await userEvent.click(chip('Оружие'))
    await userEvent.click(chip('Экология'))
    expect(feedItems()).toHaveLength(4)

    await userEvent.click(chip('Оружие'))
    await userEvent.click(chip('Экология'))
    expect(feedItems()).toHaveLength(5)
  })

  it('says so when the filters match nothing', async () => {
    render(
      <Dashboard
        log={gameLog({
          rounds: [
            record({
              round: 1,
              events: [event({ type: 'shield_built', target: 'russia-1', round: 1 })],
            }),
          ],
        })}
      />,
    )
    await userEvent.click(chip('Дипломатия'))
    expect(screen.getByText('Под эти фильтры ничего не попало.')).toBeTruthy()
  })

  it('keeps the round and the kind filters independent', async () => {
    render(<Dashboard log={playedLog()} />)
    await userEvent.click(chip('Раунд 1'))
    await userEvent.click(chip('Развитие'))
    expect(feedItems()).toHaveLength(1)
    expect(feedItems()[0]).toContain('Москва: развитие')
  })
})

describe('Dashboard · what the room may learn', () => {
  // The dashboard is meant for a projector: it must never reveal who struck.
  it('never names the author of a strike', () => {
    render(<Dashboard log={playedLog()} />)
    const strike = feedItems().find((t) => t.includes('Ядерный удар'))!
    expect(strike).toContain('Вашингтон')
    expect(strike).not.toContain('Россия')
  })

  it('keeps the budget of a country off the screen', () => {
    render(<Dashboard log={playedLog()} />)
    expect(screen.queryByText(/Потрачено/)).toBeNull()
    expect(feedItems().some((t) => t.includes('$'))).toBe(false)
  })
})
