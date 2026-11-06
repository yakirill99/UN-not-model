/**
 * Polygon treemap: one territory, many cells, each cell's area follows its
 * value. The «Мир» tab uses it to draw the cities of our state as polygons of
 * one country-shaped outline — «чем большее значение несёт город, тем больше
 * фигура».
 *
 * The algorithm is recursive bisection: the container polygon is cut by a
 * straight line into two parts whose areas match the weights of the left and
 * right halves of the value list, then each part is cut again (alternating the
 * cut direction). Pure geometry — no dependencies, deterministic output.
 */

export type Pt = { x: number; y: number }
export type Poly = Pt[]

/** Shoelace formula; the result is always positive. */
export function polygonArea(poly: Poly): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

/** Center of mass of a polygon; falls back to the vertex average when degenerate. */
export function polygonCentroid(poly: Poly): Pt {
  if (poly.length === 0) return { x: 0, y: 0 }
  let cx = 0
  let cy = 0
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a.x * b.y - b.x * a.y
    s += cross
    cx += (a.x + b.x) * cross
    cy += (a.y + b.y) * cross
  }
  if (Math.abs(s) < 1e-9) {
    return {
      x: poly.reduce((t, p) => t + p.x, 0) / poly.length,
      y: poly.reduce((t, p) => t + p.y, 0) / poly.length,
    }
  }
  return { x: cx / (3 * s), y: cy / (3 * s) }
}

/**
 * Keep only the part of the polygon where f(p) >= 0 (Sutherland–Hodgman).
 * The polygon stays a closed ring; a fully kept or fully cut input returns
 * the whole ring or an empty array.
 */
export function clipByLine(poly: Poly, f: (p: Pt) => number): Poly {
  const out: Poly = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = f(a)
    const db = f(b)
    const aIn = da >= 0
    const bIn = db >= 0
    if (aIn) out.push(a)
    if (aIn !== bIn) {
      const t = da / (da - db)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

/**
 * Cut the polygon into two rings: the left one holds `frac` of the total area.
 * `axis` 'x' cuts vertically (the left part has smaller x), 'y' cuts
 * horizontally. The cut position is found by binary search, which also works
 * for concave containers.
 */
export function sliceByFraction(poly: Poly, frac: number, axis: 'x' | 'y'): [Poly, Poly] {
  const coord = (p: Pt) => (axis === 'x' ? p.x : p.y)
  const lo = Math.min(...poly.map(coord))
  const hi = Math.max(...poly.map(coord))
  const target = polygonArea(poly) * Math.min(Math.max(frac, 0), 1)
  let a = lo
  let b = hi
  for (let i = 0; i < 48; i++) {
    const mid = (a + b) / 2
    const left = clipByLine(poly, (p) => mid - coord(p))
    if (polygonArea(left) < target) a = mid
    else b = mid
  }
  const c = (a + b) / 2
  const left = clipByLine(poly, (p) => c - coord(p))
  const right = clipByLine(poly, (p) => coord(p) - c)
  return [left, right]
}

/**
 * Lay the values out inside the container. Returns one polygon per value, in
 * the same order; cell areas are proportional to the weights. Zero and
 * negative values are lifted to a small floor so a destroyed or bankrupt city
 * still gets a visible sliver instead of vanishing.
 */
export function layoutTreemap(container: Poly, values: number[]): Poly[] {
  if (values.length === 0) return []
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0)
  const floor = total > 0 ? total * 0.004 : 1
  const weights = values.map((v) => Math.max(v, floor))
  const cells: Poly[] = new Array(values.length)
  place(container, weights, 0, values.length, sum(weights), 0, cells)
  return cells
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0)
}

function place(
  poly: Poly,
  weights: number[],
  from: number,
  to: number,
  wTotal: number,
  depth: number,
  out: Poly[],
): void {
  if (to - from <= 1) {
    out[from] = poly
    return
  }
  // Split the value list where the cumulative weight is closest to one half —
  // this keeps cells roughly convex instead of long stripes.
  let acc = 0
  let split = from + 1
  let best = Number.POSITIVE_INFINITY
  for (let i = from; i < to; i++) {
    acc += weights[i]
    const diff = Math.abs(acc - wTotal / 2)
    if (diff < best && i + 1 < to) {
      best = diff
      split = i + 1
    }
  }
  let wLeft = 0
  for (let i = from; i < split; i++) wLeft += weights[i]
  const axis = depth % 2 === 0 ? 'x' : 'y'
  const [left, right] = sliceByFraction(poly, wLeft / wTotal, axis)
  place(left, weights, from, split, wLeft, depth + 1, out)
  place(right, weights, split, to, wTotal - wLeft, depth + 1, out)
}

/** SVG path of a ring: "M x y L … Z", rounded to keep the markup compact. */
export function pathOf(poly: Poly): string {
  const round = (n: number) => Math.round(n * 100) / 100
  if (poly.length === 0) return ''
  const [first, ...rest] = poly
  return `M${round(first.x)} ${round(first.y)}${rest
    .map((p) => `L${round(p.x)} ${round(p.y)}`)
    .join('')}Z`
}
