import { describe, expect, it } from 'vitest'
import { hexClusters, hexPoints, type Hex } from './hex'

const BOX = { w: 640, h: 400 }

/** Two pointy-top hexagons never overlap once their centres sit this far apart. */
const CLEAR = (a: Hex, b: Hex) => Math.hypot(a.cx - b.cx, a.cy - b.cy)
const MIN_CLEAR = (a: Hex, b: Hex) => (a.r + b.r) * Math.cos(Math.PI / 6)

describe('hexClusters', () => {
  it('returns one hexagon per city, empty in — empty out', () => {
    expect(hexClusters([], BOX)).toEqual([])
    const [city] = hexClusters([100], BOX)
    expect(city.cells).toHaveLength(1)
    const four = hexClusters([100, 50, 25, 0], BOX)
    expect(four).toHaveLength(4)
    expect(four.filter((c) => c.cells.length === 1)).toHaveLength(4)
  })

  it('centres the cluster in the box, big hexagons for few cities', () => {
    const [city] = hexClusters([100], BOX)
    expect(Math.abs(city.cx - BOX.w / 2)).toBeLessThan(2)
    expect(Math.abs(city.cy - BOX.h / 2)).toBeLessThan(2)
    expect(city.cells[0].r).toBeGreaterThan(80) // a lone country fills the card
  })

  it('carries the size by BOTH life and development (the caller folds them into the weight)', () => {
    const weight = (life: number, dev: number) => (life / 100) * dev
    const [strong, weak] = hexClusters([weight(7590, 195), weight(3465, 70)], BOX)
    expect(strong.cells[0].r).toBeGreaterThan(weak.cells[0].r)
  })

  it('the strongest city is the biggest, the weakest never smaller than half of it', () => {
    const clusters = hexClusters([500, 300, 200, 100], BOX)
    const radii = clusters.map((c) => c.cells[0].r)
    expect(radii[0]).toBe(Math.max(...radii))
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(Math.max(...radii) / 2 - 0.01)
  })

  it('packs hexagons flush side by side: touching, never overlapping', () => {
    const clusters = hexClusters([500, 300, 200, 100, 60], BOX)
    const all = clusters.map((c) => c.cells[0])
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        // No overlap: centres stay one flat-pair apart (small tolerance for
        // the flush contact itself).
        expect(CLEAR(all[i], all[j])).toBeGreaterThanOrEqual(MIN_CLEAR(all[i], all[j]) - 0.5)
      }
    }
    // And every city has a neighbour it touches (the rug is one piece).
    const touching = all.filter((a) =>
      all.some((b) => b !== a && CLEAR(a, b) <= (a.r + b.r) * 1.001),
    )
    expect(touching.length).toBe(all.length)
  })

  it('keeps every hexagon inside the box', () => {
    const clusters = hexClusters([500, 300, 200, 100, 60], BOX)
    for (const cluster of clusters) {
      for (const c of cluster.cells) {
        expect(c.cx - c.r).toBeGreaterThanOrEqual(BOX.w * 0.01)
        expect(c.cx + c.r).toBeLessThanOrEqual(BOX.w * 0.99)
        expect(c.cy - c.r).toBeGreaterThanOrEqual(BOX.h * 0.01)
        expect(c.cy + c.r).toBeLessThanOrEqual(BOX.h * 0.99)
      }
    }
  })

  it('gives a destroyed city one small hexagon next to the living ones', () => {
    const [alive, dead] = hexClusters([100, 0], BOX)
    expect(dead.cells[0].r).toBeLessThan(alive.cells[0].r)
    // And it touches the living territory, not floating somewhere far.
    expect(CLEAR(alive.cells[0], dead.cells[0])).toBeLessThan(
      (alive.cells[0].r + dead.cells[0].r) * 1.01,
    )
  })

  it('the equal field packs as equal hexagons in a rug', () => {
    // Round one: every life is 0.00 % — the cities must still read as equal
    // neighbours, not confetti.
    const clusters = hexClusters([0, 0, 0, 0], BOX)
    const radii = clusters.map((c) => c.cells[0].r.toFixed(6))
    expect(new Set(radii).size).toBe(1)
    const all = clusters.map((c) => c.cells[0])
    const touching = all.filter((a) =>
      all.some((b) => b !== a && CLEAR(a, b) <= (a.r + b.r) * 1.001),
    )
    expect(touching.length).toBe(all.length)
  })

  it('is deterministic: the same weights give the same picture', () => {
    const a = hexClusters([90, 70, 70, 40, 10], BOX)
    const b = hexClusters([90, 70, 70, 40, 10], BOX)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('scales to any box: a narrow card keeps the rug inside', () => {
    const narrow = { w: 320, h: 220 }
    const clusters = hexClusters([100, 60, 30, 10], narrow)
    for (const cluster of clusters) {
      const c = cluster.cells[0]
      expect(c.cx - c.r).toBeGreaterThanOrEqual(-0.01)
      expect(c.cx + c.r).toBeLessThanOrEqual(narrow.w + 0.01)
      expect(c.cy - c.r).toBeGreaterThanOrEqual(-0.01)
      expect(c.cy + c.r).toBeLessThanOrEqual(narrow.h + 0.01)
    }
  })
})

describe('hexPoints', () => {
  it('builds six corners around the centre', () => {
    const pts = hexPoints({ cx: 10, cy: 20, r: 5 })
      .split(' ')
      .map((p) => p.split(',').map(Number))
    expect(pts).toHaveLength(6)
    for (const [x, y] of pts) {
      expect(Math.hypot(x - 10, y - 20)).toBeCloseTo(5, 2)
    }
    // Pointy-top: the first corner sits 30° off the x axis (vertex up, flats left/right).
    expect(pts[0][0]).toBeCloseTo(10 + 5 * Math.cos(Math.PI / 6), 2)
  })
})
