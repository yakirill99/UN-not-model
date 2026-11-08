import { describe, expect, it } from 'vitest'
import { squarify, type Rect } from './treemap'

const CONTAINER: Rect = { x: 10, y: 20, w: 300, h: 150 }

const areaOf = (r: Rect) => r.w * r.h
const totalArea = (rs: Rect[]) => rs.reduce((s, r) => s + areaOf(r), 0)
const aspect = (r: Rect) => Math.max(r.w, r.h) / Math.min(r.w, r.h)

/** Nothing may stick out of the container. */
function inside(rs: Rect[], c: Rect) {
  for (const r of rs) {
    expect(r.x).toBeGreaterThanOrEqual(c.x - 0.01)
    expect(r.y).toBeGreaterThanOrEqual(c.y - 0.01)
    expect(r.x + r.w).toBeLessThanOrEqual(c.x + c.w + 0.01)
    expect(r.y + r.h).toBeLessThanOrEqual(c.y + c.h + 0.01)
  }
}

describe('squarify', () => {
  it('gives equal values equal cells', () => {
    const cells = squarify(CONTAINER, [1, 1, 1, 1])
    expect(cells).toHaveLength(4)
    for (const cell of cells) {
      expect(areaOf(cell) / totalArea(cells)).toBeCloseTo(0.25, 2)
    }
  })

  it('scales cells with the values: the leader visibly dominates', () => {
    const cells = squarify(CONTAINER, [8, 2, 2])
    const total = totalArea(cells)
    expect(areaOf(cells[0]) / total).toBeCloseTo(8 / 12, 2)
    for (const cell of cells.slice(1)) {
      expect(areaOf(cell) / total).toBeCloseTo(2 / 12, 2)
    }
  })

  it('covers the whole container without gaps', () => {
    const cells = squarify(CONTAINER, [5, 3, 4, 1, 2])
    expect(totalArea(cells)).toBeCloseTo(areaOf(CONTAINER), 0)
    inside(cells, CONTAINER)
  })

  it('keeps cells close to squares (the «squarified» promise)', () => {
    const cells = squarify({ x: 0, y: 0, w: 100, h: 100 }, [6, 3, 2, 1, 1, 1])
    for (const cell of cells) {
      expect(aspect(cell)).toBeLessThan(4)
    }
  })

  it('keeps a visible sliver for a zero value instead of erasing the city', () => {
    const cells = squarify(CONTAINER, [0, 1])
    expect(areaOf(cells[0])).toBeGreaterThan(areaOf(CONTAINER) * 0.002)
  })

  it('returns the whole container for a single city', () => {
    const cells = squarify(CONTAINER, [7])
    expect(cells).toHaveLength(1)
    expect(cells[0]).toEqual(CONTAINER)
  })

  it('handles the empty city list', () => {
    expect(squarify(CONTAINER, [])).toEqual([])
  })

  it('is deterministic: the same values give the same layout', () => {
    const a = squarify(CONTAINER, [4, 4, 2, 1])
    const b = squarify(CONTAINER, [4, 4, 2, 1])
    expect(a).toEqual(b)
  })
})
