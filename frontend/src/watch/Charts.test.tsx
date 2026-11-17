import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { playedLog } from '../test/log'
import { DeedsChart, EcologyChart, LifeChart, StandingsLegend } from './Charts'
import { COLORS, colorOf } from './colors'
import { ecologyLine, lifeLines, standings } from './core'

/** recharts renders plain SVG: read it through its own stable class names. */
const svgOf = (container: HTMLElement) => container.querySelector('svg')!

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
  it('draws the ecology area with axes', () => {
    const { container } = render(<EcologyChart points={ecologyLine(playedLog())} />)
    expect(svgOf(container).querySelector('.recharts-area')).toBeTruthy()
    expect(svgOf(container).querySelectorAll('.recharts-cartesian-axis')).toHaveLength(2)
  })

  it('marks the danger zone below 40 % with a shaded area and a line', () => {
    const { container } = render(<EcologyChart points={ecologyLine(playedLog())} />)
    expect(svgOf(container).querySelector('.recharts-reference-area')).toBeTruthy()
    expect(svgOf(container).querySelector('.recharts-reference-line')).toBeTruthy()
  })

  it('renders without points instead of crashing', () => {
    const { container } = render(<EcologyChart points={[]} />)
    expect(svgOf(container)).toBeTruthy()
    expect(svgOf(container).querySelector('.recharts-area')).toBeNull()
  })
})

describe('LifeChart', () => {
  it('draws one line per country', () => {
    const { container } = render(<LifeChart series={lifeLines(playedLog())} />)
    expect(svgOf(container).querySelectorAll('.recharts-line')).toHaveLength(
      lifeLines(playedLog()).length,
    )
  })

  it('spells the countries in the legend and carries the round-history brush', () => {
    render(<LifeChart series={lifeLines(playedLog())} />)
    for (const country of ['Россия', 'США']) {
      expect(screen.getByText(country)).toBeTruthy()
    }
    // «чтобы была история раундов в том числе» — the brush strips the rounds.
    expect(document.querySelector('.recharts-brush')).toBeTruthy()
  })

  it('hides a country when its legend entry is clicked — «выделять объекты»', async () => {
    const series = lifeLines(playedLog())
    const { container } = render(<LifeChart series={series} />)
    const before = svgOf(container).querySelectorAll('.recharts-line').length
    await userEvent.click(screen.getByText('Россия'))
    const after = svgOf(container).querySelectorAll('.recharts-line').length
    expect(after).toBeLessThan(before)
  })
})

describe('DeedsChart', () => {
  it('draws a bar per deed with its count', () => {
    render(
      <DeedsChart
        slices={[
          { id: 'invest', label: 'Инвестиции', count: 7 },
          { id: 'bomb', label: 'Бомбы', count: 3 },
        ]}
      />,
    )
    expect(screen.getByText('Инвестиции')).toBeTruthy()
    expect(screen.getByText('7')).toBeTruthy()
  })
})

describe('StandingsLegend', () => {
  it('lists the countries with the final number', () => {
    render(<StandingsLegend series={standings(playedLog())} />)
    const items = document.querySelectorAll('.legend li')
    expect(items.length).toBeGreaterThan(0)
  })
})
