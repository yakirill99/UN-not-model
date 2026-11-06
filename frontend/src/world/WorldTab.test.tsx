import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { foreign, me, observation, ownCity } from '../test/observation'
import WorldTab from './WorldTab'

const OBS = observation({
  me: me({
    cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург', life_level: 2000, shield: true })],
  }),
  others: [
    foreign(),
    foreign({
      id: 'atlantis',
      name: 'Атлантида',
      average_life_level: 1000,
      cities: [{ id: 'a1', name: 'Атлант', destroyed: false, life_level: 1000 }],
    }),
  ],
})

function renderTab(gameId = 'g9') {
  return render(<WorldTab obs={OBS} gameId={gameId} />)
}

beforeEach(() => window.localStorage.clear())

describe('WorldTab: the world map', () => {
  it('draws every country of the game: ours, known and unknown', () => {
    renderTab()
    expect(screen.getByRole('button', { name: 'Россия на карте (это мы)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'США на карте — нейтрал' })).toBeTruthy()
    // Атлантиды нет в геотаблице — она попадает в индексную полосу внизу.
    expect(screen.getByRole('button', { name: 'Атлантида на карте — нейтрал' })).toBeTruthy()
  })

  it('shows the legend: blue us, green friends, gray neutral, red enemies', () => {
    renderTab()
    for (const word of ['Мы', 'Друг', 'Нейтрал', 'Враг']) {
      expect(screen.getByText(word)).toBeTruthy()
    }
  })

  it('selects a country and shows the stats the fog of war allows', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'США на карте — нейтрал' }))
    expect(screen.getByText(/Средняя жизнь: 60\.00 %/)).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Отношение к стране США' })).toBeTruthy()
  })

  it('marks a country as an enemy and remembers the choice', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'США на карте — нейтрал' }))
    const enemy = screen.getByRole('button', { name: 'Враг' })
    expect(enemy.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(enemy)
    expect(screen.getByRole('button', { name: 'США на карте — враг' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Враг' }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem('arena-diplo:g9')).toContain('"usa":"enemy"')
  })

  it('restores the marks from storage on load', () => {
    window.localStorage.setItem('arena-diplo:g9', JSON.stringify({ usa: 'friend' }))
    renderTab()
    expect(screen.getByRole('button', { name: 'США на карте — друг' })).toBeTruthy()
    // The switch itself appears once the country is selected.
    fireEvent.click(screen.getByRole('button', { name: 'США на карте — друг' }))
    expect(screen.getByRole('button', { name: 'Друг' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps our own country out of diplomacy', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Россия на карте (это мы)' }))
    expect(screen.getByText('это мы')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /Отношение к стране/ })).toBeNull()
  })

  it('deselects a country on the second click', () => {
    renderTab()
    const usa = screen.getByRole('button', { name: 'США на карте — нейтрал' })
    fireEvent.click(usa)
    fireEvent.click(screen.getByRole('button', { name: 'США на карте — нейтрал' }))
    expect(screen.queryByRole('group', { name: 'Отношение к стране США' })).toBeNull()
  })
})

describe('WorldTab: the city polygon', () => {
  it('draws the edge statistics around the territory', () => {
    renderTab()
    expect(screen.getByText('Городов целы: 2 из 2')).toBeTruthy()
    expect(screen.getByText('Средняя жизнь: 45.67 %')).toBeTruthy()
    expect(screen.getByText('Щитов: 1')).toBeTruthy()
    expect(screen.getByText('Разрушено: 0')).toBeTruthy()
  })

  it('highlights a city both on the polygon and in the list', () => {
    renderTab()
    fireEvent.click(screen.getByRole('button', { name: 'Москва: жизнь 55.00 %' }))
    expect(
      screen.getByRole('button', { name: 'Москва: жизнь 55.00 %' }).getAttribute('aria-pressed'),
    ).toBe('true')
    // The row in the list below lights up too: two views of one selection.
    const row = screen
      .getAllByRole('button', { name: /Москва/ })
      .map((b) => b.closest('li'))
      .find(Boolean)
    expect(row?.className).toBe('on')
  })

  it('marks a destroyed city and keeps its sliver on the map', () => {
    const obs = observation({
      me: me({ cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург', destroyed: true })] }),
      others: [foreign()],
    })
    render(<WorldTab obs={obs} gameId="g9" />)
    expect(screen.getByRole('button', { name: 'Петербург: разрушен' })).toBeTruthy()
    expect(screen.getByText('Разрушено: 1')).toBeTruthy()
    expect(screen.getByText('Городов целы: 1 из 2')).toBeTruthy()
  })

  it('starts with no city selected', () => {
    renderTab()
    for (const li of screen.getAllByRole('listitem')) {
      expect(li.className).not.toBe('on')
    }
  })
})
