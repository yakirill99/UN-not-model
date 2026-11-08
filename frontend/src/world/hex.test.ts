import { describe, expect, it } from 'vitest'
import { hexClusters, hexPoints, type Hex } from './hex'

const BOX = { w: 640, h: 400 }

/** Cells of one cluster touch when their centres sit √3·r apart (flat-top). */
const TOUCH = (a: Hex, b: Hex) => Math.hypot(a.cx - b.cx, a.cy - b.cy)
const NEAR = (a: Hex, b: Hex, eps = 0.5) => Math.abs(TOUCH(a, b) - Math.sqrt(3) * a.r) < eps

describe('hexClusters', () => {
  it('returns one cluster per value, empty in — empty out', () => {
    expect(hexClusters([], BOX)).toEqual([])
    expect(hexClusters([100], BOX)).toHaveLength(1)
    expect(hexClusters([100, 50, 25, 0], BOX)).toHaveLength(4)
  })

  it('centres a lone city in the box with big cells', () => {
    const [city] = hexClusters([100], BOX)
    // The label sits on the cluster's centroid — near the middle of the card.
    expect(Math.abs(city.cx - BOX.w / 2)).toBeLessThan(15)
    expect(Math.abs(city.cy - BOX.h / 2)).toBeLessThan(15)
    // Few cities get big cells: a lone country is a bold honeycomb, not grain.
    expect(city.cells[0].r).toBeGreaterThan(25)
  })

  it('scales the territory with the weight: more cells for a stronger city', () => {
    const [big, small] = hexClusters([400, 100], BOX)
    expect(big.cells.length).toBeGreaterThan(small.cells.length * 3)
  })

  it('carries the size by BOTH life and development (the caller folds them into the weight)', () => {
    const weight = (life: number, dev: number) => (life / 100) * dev
    const [strong, weak] = hexClusters([weight(7590, 195), weight(3465, 70)], BOX)
    expect(strong.cells.length).toBeGreaterThan(weak.cells.length)
  })

  it('packs every city as one contiguous blob', () => {
    const clusters = hexClusters([500, 300, 200, 100, 60, 30], BOX)
    for (const cluster of clusters) {
      expect(cluster.cells.length).toBeGreaterThan(0)
      // Flood-fill from the first cell: every cell must be reachable by steps
      // between touching neighbours of the same cluster.
      const seen = new Set([0])
      const queue = [0]
      while (queue.length > 0) {
        const i = queue.pop()!
        for (let j = 0; j < cluster.cells.length; j++) {
          if (!seen.has(j) && NEAR(cluster.cells[i], cluster.cells[j])) {
            seen.add(j)
            queue.push(j)
          }
        }
      }
      expect(seen.size).toBe(cluster.cells.length)
    }
  })

  it('lets the cells of different cities touch edge to edge, never overlap', () => {
    const clusters = hexClusters([500, 300, 200, 100, 60, 30], BOX)
    const all = clusters.flatMap((c) => c.cells)
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const d = TOUCH(all[i], all[j])
        // Grid neighbours sit at exactly √3·r; anything closer is an overlap.
        expect(d).toBeGreaterThanOrEqual(Math.sqrt(3) * all[i].r - 0.05)
      }
    }
    // And the honeycomb is dense: neighbours of a cell are present at √3·r.
    const touches = all.filter((a) => all.some((b) => b !== a && NEAR(a, b)))
    expect(touches.length).toBeGreaterThan(all.length / 2)
  })

  it('keeps every cell inside the box', () => {
    const clusters = hexClusters([500, 300, 200, 100, 60, 30], BOX)
    for (const cluster of clusters) {
      for (const c of cluster.cells) {
        expect(c.cx - c.r).toBeGreaterThanOrEqual(-0.01)
        expect(c.cx + c.r).toBeLessThanOrEqual(BOX.w + 0.01)
        expect(c.cy - (c.r * Math.sqrt(3)) / 2).toBeGreaterThanOrEqual(-0.01)
        expect(c.cy + (c.r * Math.sqrt(3)) / 2).toBeLessThanOrEqual(BOX.h + 0.01)
      }
    }
  })

  it('gives a destroyed city one small red cell next to the living blob', () => {
    const [alive, dead] = hexClusters([100, 0], BOX)
    expect(dead.cells).toHaveLength(1)
    expect(alive.cells.length).toBeGreaterThan(5)
    // The ruin still touches the country it belonged to.
    expect(dead.cells.some((dc) => alive.cells.some((ac) => NEAR(dc, ac)))).toBe(true)
  })

  it('uses the box: a seven-city field spans most of the card', () => {
    const clusters = hexClusters([100, 90, 80, 70, 60, 50, 40], BOX)
    const all = clusters.flatMap((c) => c.cells)
    const minX = Math.min(...all.map((c) => c.cx - c.r))
    const maxX = Math.max(...all.map((c) => c.cx + c.r))
    // The clump is height-limited here, but it still covers most of the width.
    expect(maxX - minX).toBeGreaterThan(BOX.w * 0.58)
  })

  it('marks the sides facing another city as border edges ON the shared face', () => {
    const clusters = hexClusters([500, 200], BOX)
    const [first] = clusters
    // Every edge sits on a real face: its midpoint is √3/2·r from the cell's
    // centre (halfway to the neighbour), and its length is one full side (r).
    for (const cluster of clusters) {
      for (const cell of cluster.cells) {
        for (const e of cell.edges) {
          const mid = [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2]
          expect(Math.hypot(mid[0] - cell.cx, mid[1] - cell.cy)).toBeCloseTo(
            (Math.sqrt(3) / 2) * cell.r,
            1,
          )
          const length = Math.hypot(e[2] - e[0], e[3] - e[1])
          expect(length).toBeCloseTo(cell.r, 1)
        }
      }
    }
    // A two-city map has at least one REAL border between the cities.
    expect(first.cells.some((c) => c.edges.length > 0)).toBe(true)
  })

  it('is deterministic: the same weights give the same picture', () => {
    const a = hexClusters([90, 70, 70, 40, 10], BOX)
    const b = hexClusters([90, 70, 70, 40, 10], BOX)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles the equal field: identical cities share the card fairly', () => {
    const clusters = hexClusters([50, 50, 50], BOX)
    expect(new Set(clusters.map((c) => c.cells.length))).toHaveProperty('size', 1)
    expect(new Set(clusters.map((c) => c.cells[0].r.toFixed(6)))).toHaveProperty('size', 1)
  })
})

describe('hexPoints', () => {
  it('builds six corners around the centre', () => {
    const pts = hexPoints({ cx: 100, cy: 50, r: 10 }).split(' ')
    expect(pts).toHaveLength(6)
    // Flat-top: the first corner sits exactly one radius to the right.
    const [x, y] = pts[0].split(',').map(Number)
    expect(x).toBeCloseTo(110, 1)
    expect(y).toBeCloseTo(50, 1)
  })
})
