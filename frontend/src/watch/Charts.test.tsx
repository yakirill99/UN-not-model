import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { playedLog } from '../test/log'
import { DeedsChart, EcologyChart, Legend, LifeChart } from './Charts'
import { COLORS, colorOf } from './colors'
import { ecologyLine, lifeLines, standings } from './core'

const svg = () => screen.getByRole('img')

/** SVG <title> is not an accessible name here: read the elements directly. */
const titles = () => [...svg().querySelectorAll('title')].map((t) => t.textContent)

describe('colorOf', () => {
  it('gives each country its own colour', () => {
    expect(colorOf(0)).toBe(COLORS[0])
    expect(colorOf(1)).not.toBe(colorOf(0))
  })

  it('wraps round when there are more countries than colours', () => {
    expect(colorOf(COLORS.length)).toBe(COLORS[0])
  })
})

describe('EcologyChart', () => {
  it('draws a point per round and names the value in a tooltip', () => {
    render(<EcologyChart points={ecologyLine(playedLog())} />)
    expect(svg().querySelectorAll('circle')).toHaveLength(3)
    expect(titles()).toContain('Раунд 1: 85 %')
  })

  it('draws no line for a single point, so an unplayed game is not a trend', () => {
    render(<EcologyChart points={[{ round: 0, value: 100 }]} />)
    expect(svg().querySelector('polyline')).toBeNull()
    expect(svg().querySelectorAll('circle')).toHaveLength(1)
  })

  it('renders without points instead of crashing', () => {
    render(<EcologyChart points={[]} />)
    expect(svg().querySelectorAll('circle')).toHaveLength(0)
  })

  it('shades the danger zone below 40 %', () => {
    render(<EcologyChart points={ecologyLine(playedLog())} />)
    expect(svg().querySelector('.zone-bad')).toBeTruthy()
  })
})

describe('LifeChart', () => {
  it('draws one line per country', () => {
    render(<LifeChart series={lifeLines(playedLog())} />)
    expect(svg().querySelectorAll('polyline')).toHaveLength(2)
  })

  it('puts the final score in each line’s tooltip', () => {
    render(<LifeChart series={lifeLines(playedLog())} />)
    expect(titles()).toEqual(['Россия: 60.0 %', 'США: 25.0 %'])
  })

  it('renders an empty game without dividing by zero', () => {
    render(<LifeChart series={[{ id: 'x', name: 'X', points: [] }]} />)
    expect(svg().querySelectorAll('polyline')).toHaveLength(1)
  })
})

describe('DeedsChart', () => {
  it('shows a labelled bar per action', () => {
    render(
      <DeedsChart
        slices={[
          { id: 'city_invested', label: 'Инвестиции', count: 4 },
          { id: 'nuclear_strike', label: 'Удары', count: 1 },
        ]}
      />,
    )
    expect(screen.getByText('Инвестиции')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
  })

  it('scales the widest bar to the full track', () => {
    const { container } = render(
      <DeedsChart
        slices={[
          { id: 'a', label: 'A', count: 4 },
          { id: 'b', label: 'B', count: 2 },
        ]}
      />,
    )
    const fills = container.querySelectorAll<HTMLElement>('.bar-fill')
    expect(fills[0].style.width).toBe('100%')
    expect(fills[1].style.width).toBe('50%')
  })

  it('renders nothing for an empty list', () => {
    const { container } = render(<DeedsChart slices={[]} />)
    expect(container.querySelectorAll('.bar-row')).toHaveLength(0)
  })
})

describe('Legend', () => {
  it('doubles as the standings, best first', () => {
    render(<Legend series={standings(playedLog())} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows[0].textContent).toBe('Россия60.0 %')
    expect(rows[1].textContent).toBe('США25.0 %')
  })
})
