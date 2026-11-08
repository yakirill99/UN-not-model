import { describe, expect, it } from 'vitest'
import { hexLayout, hexPoints } from './hex'

const BOX = { w: 640, h: 400 }

describe('hexLayout', () => {
  it('returns one hexagon per value, empty in — empty out', () => {
    expect(hexLayout([], BOX)).toEqual([])
    expect(hexLayout([100], BOX)).toHaveLength(1)
    expect(hexLayout([100, 50, 25, 0], BOX)).toHaveLength(4)
  })

  it('centres a lone city in the box', () => {
    const [hex] = hexLayout([100], BOX)
    expect(hex.cx).toBeCloseTo(BOX.w / 2, 6)
    expect(hex.cy).toBeCloseTo(BOX.h / 2, 6)
    // The lone hexagon spans the whole card.
    expect(hex.r).toBeGreaterThan(150)
  })

  it('makes the area follow the value: radius grows like the square root', () => {
    const [big, small] = hexLayout([400, 100], BOX, 0)
    expect(small.r / big.r).toBeCloseTo(Math.sqrt(100 / 400), 6)
  })

  it('never lets two hexagons overlap', () => {
    const hexes = hexLayout([300, 220, 180, 140, 90, 40, 20, 5], BOX)
    for (let i = 0; i < hexes.length; i++) {
      for (let j = i + 1; j < hexes.length; j++) {
        const d = Math.hypot(hexes[i].cx - hexes[j].cx, hexes[i].cy - hexes[j].cy)
        expect(d).toBeGreaterThanOrEqual((hexes[i].r + hexes[j].r) * 1.18 - 0.02)
      }
    }
  })

  it('keeps the clump compact: the reach from the centre is comparable to the hexagons', () => {
    // The first cut of the layout used an absolute 6-px gap on unit radii —
    // after the fit-to-box scale the hexagons floated far apart. Guard it:
    // the farthest centre sits a couple of radii from the middle, not 10.
    const hexes = hexLayout([100, 80, 60, 40], BOX)
    const spread = Math.max(...hexes.map((h) => Math.hypot(h.cx - BOX.w / 2, h.cy - BOX.h / 2)))
    const maxR = Math.max(...hexes.map((h) => h.r))
    expect(spread).toBeLessThan(maxR * 4)
  })

  it('keeps every hexagon inside the box', () => {
    const hexes = hexLayout([500, 300, 200, 100, 60, 30], BOX)
    for (const h of hexes) {
      expect(h.cx - h.r).toBeGreaterThanOrEqual(-0.01)
      expect(h.cx + h.r).toBeLessThanOrEqual(BOX.w + 0.01)
      expect(h.cy - (h.r * Math.sqrt(3)) / 2).toBeGreaterThanOrEqual(-0.01)
      expect(h.cy + (h.r * Math.sqrt(3)) / 2).toBeLessThanOrEqual(BOX.h + 0.01)
    }
  })

  it('gives a destroyed city a small but visible hexagon', () => {
    const hexes = hexLayout([100, 0], BOX)
    const [alive, dead] = hexes
    expect(dead.r).toBeGreaterThan(0)
    expect(dead.r).toBeLessThan(alive.r / 2)
  })

  it('uses the box: a seven-city field spans most of the card', () => {
    const hexes = hexLayout([100, 90, 80, 70, 60, 50, 40], BOX)
    const minX = Math.min(...hexes.map((h) => h.cx - h.r))
    const maxX = Math.max(...hexes.map((h) => h.cx + h.r))
    // The clump is height-limited here, so two thirds of the width is dense.
    expect(maxX - minX).toBeGreaterThan(BOX.w * 0.6)
  })

  it('is deterministic: the same weights give the same picture', () => {
    const a = hexLayout([90, 70, 70, 40, 10], BOX)
    const b = hexLayout([90, 70, 70, 40, 10], BOX)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles the equal field: identical hexagons in a ring', () => {
    const hexes = hexLayout([50, 50, 50], BOX)
    expect(new Set(hexes.map((h) => h.r.toFixed(6))).size).toBe(1)
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
