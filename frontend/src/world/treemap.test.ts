import { describe, expect, it } from 'vitest'
import {
  clipByLine,
  layoutTreemap,
  pathOf,
  polygonArea,
  polygonCentroid,
  sliceByFraction,
  type Poly,
} from './treemap'

const RECT: Poly = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 50 },
  { x: 0, y: 50 },
]

/** The same irregular outline CityMap draws. */
const TERRITORY: Poly = [
  { x: 30, y: 30 },
  { x: 110, y: 20 },
  { x: 210, y: 24 },
  { x: 292, y: 48 },
  { x: 312, y: 110 },
  { x: 300, y: 178 },
  { x: 232, y: 204 },
  { x: 140, y: 208 },
  { x: 58, y: 196 },
  { x: 10, y: 138 },
  { x: 14, y: 68 },
]

const L: Poly = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 40 },
  { x: 40, y: 40 },
  { x: 40, y: 100 },
  { x: 0, y: 100 },
]

describe('polygon math', () => {
  it('measures area (shoelace)', () => {
    expect(polygonArea(RECT)).toBe(5000)
    // 100×100 minus the 60×60 cut = 6400.
    expect(polygonArea(L)).toBe(6400)
  })

  it('finds the centroid of a rectangle in its middle', () => {
    const c = polygonCentroid(RECT)
    expect(c.x).toBeCloseTo(50)
    expect(c.y).toBeCloseTo(25)
  })

  it('clips a half-plane off the polygon', () => {
    const left = clipByLine(RECT, (p) => 50 - p.x)
    expect(polygonArea(left)).toBeCloseTo(2500)
  })

  it('slices a fraction of the area', () => {
    const [a, b] = sliceByFraction(RECT, 0.25, 'x')
    expect(polygonArea(a)).toBeCloseTo(1250, 0)
    expect(polygonArea(b)).toBeCloseTo(3750, 0)
  })
})

describe('layoutTreemap', () => {
  it('gives equal values equal cells', () => {
    const cells = layoutTreemap(TERRITORY, [1, 1, 1, 1])
    const total = polygonArea(TERRITORY)
    expect(cells).toHaveLength(4)
    for (const cell of cells) {
      expect(polygonArea(cell)).toBeGreaterThan(total * 0.24)
      expect(polygonArea(cell)).toBeLessThan(total * 0.26)
    }
  })

  it('scales cells with the values: the leader visibly dominates', () => {
    const cells = layoutTreemap(TERRITORY, [8, 2, 2])
    const total = polygonArea(TERRITORY)
    expect(polygonArea(cells[0]) / total).toBeGreaterThan(0.64)
    expect(polygonArea(cells[0]) / total).toBeLessThan(0.69)
    for (const cell of cells.slice(1)) {
      expect(polygonArea(cell) / total).toBeCloseTo(1 / 6, 1)
    }
  })

  it('covers the whole container without gaps', () => {
    const cells = layoutTreemap(TERRITORY, [5, 3, 4, 1, 2])
    const total = polygonArea(TERRITORY)
    const covered = cells.reduce((s, c) => s + polygonArea(c), 0)
    expect(covered / total).toBeGreaterThan(0.99)
  })

  it('works on a concave container', () => {
    const cells = layoutTreemap(L, [1, 1, 1])
    const total = polygonArea(L)
    for (const cell of cells) {
      expect(polygonArea(cell) / total).toBeCloseTo(1 / 3, 1)
    }
  })

  it('keeps a visible sliver for a zero value instead of erasing the city', () => {
    const cells = layoutTreemap(TERRITORY, [0, 1])
    const total = polygonArea(TERRITORY)
    expect(polygonArea(cells[0])).toBeGreaterThan(total * 0.002)
  })

  it('returns the whole container for a single city', () => {
    const cells = layoutTreemap(TERRITORY, [7])
    expect(cells).toHaveLength(1)
    expect(polygonArea(cells[0])).toBeCloseTo(polygonArea(TERRITORY))
  })

  it('handles the empty city list', () => {
    expect(layoutTreemap(TERRITORY, [])).toEqual([])
  })

  it('keeps every vertex inside the container bounding box', () => {
    const cells = layoutTreemap(TERRITORY, [4, 4, 2, 1])
    const xs = TERRITORY.map((p) => p.x)
    const ys = TERRITORY.map((p) => p.y)
    for (const cell of cells) {
      for (const p of cell) {
        expect(p.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1)
        expect(p.x).toBeLessThanOrEqual(Math.max(...xs) + 1)
        expect(p.y).toBeGreaterThanOrEqual(Math.min(...ys) - 1)
        expect(p.y).toBeLessThanOrEqual(Math.max(...ys) + 1)
      }
    }
  })

  it('renders an SVG path', () => {
    const d = pathOf(RECT)
    expect(d.startsWith('M0 0')).toBe(true)
    expect(d.endsWith('Z')).toBe(true)
  })
})
