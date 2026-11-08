import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { foreign, me, observation, ownCity } from '../test/observation'
import WorldTab from './WorldTab'
import type { CountryFeature } from './worldData'

/** The atlas is mocked: Россия (643) and США (840) have real borders here,
    Атлантида does not — she must land in the index strip. */
vi.mock('./worldData', () => ({
  loadWorld: vi.fn(async (): Promise<CountryFeature[]> => [
    {
      type: 'Feature',
      id: '643',
      properties: { name: 'Russia' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [30, 50],
            [60, 55],
            [90, 50],
            [85, 65],
            [40, 60],
            [30, 50],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: '840',
      properties: { name: 'United States' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-125, 48],
            [-95, 49],
            [-70, 45],
            [-80, 25],
            [-120, 35],
            [-125, 48],
          ],
        ],
      },
    },
  ]),
}))

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
  it('draws every country of the game: ours, known and unknown', async () => {
    renderTab()
    expect(await screen.findByRole('button', { name: 'Россия на карте (это мы)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'США на карте — нейтрал' })).toBeTruthy()
    // Атлантиды нет ни в геотаблице, ни в атласе — она попадает в индексную полосу.
    expect(screen.getByRole('button', { name: 'Атлантида на карте — нейтрал' })).toBeTruthy()
  })

  it('paints the borders, not dots: the country paths carry the relation classes', async () => {
    renderTab()
    const usa = await screen.findByRole('button', { name: 'США на карте — нейтрал' })
    expect(usa.getAttribute('class')).toContain('ctr neutral')
    fireEvent.click(usa)
    fireEvent.click(screen.getByRole('button', { name: 'Враг' }))
    expect(
      screen.getByRole('button', { name: 'США на карте — враг' }).getAttribute('class'),
    ).toContain('ctr enemy')
  })

  it('shows the legend: blue us, green friends, gray neutral, red enemies', async () => {
    renderTab()
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    for (const word of ['Мы', 'Друг', 'Нейтрал', 'Враг']) {
      expect(screen.getByText(word)).toBeTruthy()
    }
  })

  it('selects a country and shows the stats the fog of war allows', async () => {
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'США на карте — нейтрал' }))
    expect(screen.getByText(/Средняя жизнь: 60\.00 %/)).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Отношение к стране США' })).toBeTruthy()
  })

  it('marks a country as an enemy and remembers the choice', async () => {
    renderTab()
    const usa = await screen.findByRole('button', { name: 'США на карте — нейтрал' })
    fireEvent.click(usa)
    const enemy = screen.getByRole('button', { name: 'Враг' })
    expect(enemy.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(enemy)
    expect(screen.getByRole('button', { name: 'США на карте — враг' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Враг' }).getAttribute('aria-pressed')).toBe('true')
    expect(window.localStorage.getItem('arena-diplo:g9')).toContain('"usa":"enemy"')
  })

  it('restores the marks from storage on load', async () => {
    window.localStorage.setItem('arena-diplo:g9', JSON.stringify({ usa: 'friend' }))
    renderTab()
    const usa = await screen.findByRole('button', { name: 'США на карте — друг' })
    // The switch itself appears once the country is selected.
    fireEvent.click(usa)
    expect(screen.getByRole('button', { name: 'Друг' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('keeps our own country out of diplomacy', async () => {
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Россия на карте (это мы)' }))
    expect(screen.getByText('это мы')).toBeTruthy()
    expect(screen.queryByRole('group', { name: /Отношение к стране/ })).toBeNull()
  })

  it('deselects a country on the second click', async () => {
    renderTab()
    const usa = await screen.findByRole('button', { name: 'США на карте — нейтрал' })
    fireEvent.click(usa)
    fireEvent.click(screen.getByRole('button', { name: 'США на карте — нейтрал' }))
    expect(screen.queryByRole('group', { name: 'Отношение к стране США' })).toBeNull()
  })
})

describe('WorldTab: the city honeycomb', () => {
  it('shows the summary above the honeycomb', async () => {
    renderTab()
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    expect(screen.getByText('Городов целы')).toBeTruthy()
    expect(screen.getByText('2 из 2')).toBeTruthy()
    expect(screen.getByText('Средняя жизнь')).toBeTruthy()
    expect(screen.getByText('45.67 %')).toBeTruthy()
    expect(screen.getByText('Щитов')).toBeTruthy()
    expect(screen.getByText('Разрушено')).toBeTruthy()
  })

  it('highlights a city both on the treemap and in the list', async () => {
    renderTab()
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
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

  it('marks a destroyed city and keeps its sliver on the map', async () => {
    const obs = observation({
      me: me({ cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург', destroyed: true })] }),
      others: [foreign()],
    })
    render(<WorldTab obs={obs} gameId="g9" />)
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    expect(screen.getByRole('button', { name: 'Петербург: разрушен' })).toBeTruthy()
    const facts = screen.getByRole('list', { name: 'Сводка по городам' })
    expect(within(facts).getByText('Разрушено').nextElementSibling?.textContent).toBe('1')
    expect(within(facts).getByText('Городов целы').nextElementSibling?.textContent).toBe('1 из 2')
  })

  it('starts with no city selected', async () => {
    renderTab()
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    for (const li of screen.getAllByRole('listitem')) {
      expect(li.className).not.toBe('on')
    }
  })

  it('draws city labels horizontally: no rotated text anywhere on the card', async () => {
    renderTab()
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    const labels = [...document.querySelectorAll('.citymap text')]
    expect(labels.length).toBeGreaterThan(0)
    for (const label of labels) {
      expect(label.getAttribute('transform')).toBeNull()
    }
  })
})

describe('WorldTab: strike arcs (#17)', () => {
  const withStrikes = observation({
    me: me({ cities: [ownCity()] }),
    others: [foreign()],
    news: [
      {
        round: 2,
        schema_version: 1,
        type: 'nuclear_strike',
        actor: 'russia',
        target: 'nyc',
        outcome: 'destroyed',
      } as never,
    ],
  })

  it('flies an arc into the target country and marks the flash', async () => {
    render(<WorldTab obs={withStrikes} gameId="g9" />)
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    const arc = document.querySelector('.world-map .arc.destroyed') as SVGPathElement | null
    expect(arc).toBeTruthy()
    // A trajectory: a quad bezier from our borders (I fired it) to the target.
    expect(arc?.getAttribute('d')).toMatch(/^M [\d.-]+ [\d.-]+ Q [\d.-]+ [\d.-]+ [\d.-]+ [\d.-]+$/)
    expect(document.querySelector('.world-map .boom.destroyed')).toBeTruthy()
  })

  it('keeps the map calm on a peaceful round', async () => {
    render(<WorldTab obs={observation({ me: me(), others: [foreign()] })} gameId="g9" />)
    await screen.findByRole('button', { name: 'Россия на карте (это мы)' })
    expect(document.querySelector('.world-map .strikes')).toBeNull()
  })
})
