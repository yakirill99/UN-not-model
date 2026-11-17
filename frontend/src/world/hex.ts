/**
 * The territory of our state on the map: ONE hexagon per city, packed side by
 * side — «сделай их рядом друг с другом». The hexagon's radius follows the
 * city's weight (life level × development), so the map reads at a glance who
 * is strong; a destroyed city keeps one small red hexagon instead of
 * vanishing. The packing places every hexagon flush against the ones already
 * laid (contact along the six flat-side directions, no overlaps), then the
 * whole cluster is scaled to fit the box — so the cities NEVER drift apart
 * and the label always sits in the middle of its own hexagon.
 *
 * Pure geometry — no dependencies, deterministic output: same weights, same
 * picture, on every machine and every reload.
 */

export type Hex = { cx: number; cy: number; r: number }

/** One city's territory: a single hexagon; `edges` is kept for API compat. */
export type Cluster = { cells: Hex[]; cx: number; cy: number }

/**
 * Corner points of a POINTY-TOP hexagon (vertex up), ready for <polygon points>.
 * Pointy-top hexagons touch side by side along vertical flats, which is the
 * packing this map uses.
 */
export function hexPoints(hex: Hex): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6
    pts.push(
      `${(hex.cx + hex.r * Math.cos(a)).toFixed(2)},${(hex.cy + hex.r * Math.sin(a)).toFixed(2)}`,
    )
  }
  return pts.join(' ')
}

/**
 * Support of a pointy-top hexagon of radius r along direction θ: how far the
 * shape reaches from its centre. Vertices sit at 30° + 60°k, so the reach
 * swings between r (towards a vertex) and r·cos(30°) ≈ 0.866r (towards a
 * flat's middle). Two hexagons placed in direction θ touch flush when their
 * centre distance equals reachA(θ) + reachB(θ + 180°).
 */
function reach(r: number, theta: number): number {
  const delta = Math.abs((((theta - Math.PI / 6) % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3))
  const toVertex = Math.min(delta, Math.PI / 3 - delta)
  return r * Math.cos(toVertex)
}

/** The smallest reach — a safe no-overlap lower bound for any direction. */
const FLAT = Math.cos(Math.PI / 6) // ≈ 0.866

/**
 * Lay the weights out as touching hexagons inside the box.
 * Returns one cluster per value, in the same order.
 *
 * Radii: the strongest city gets `maxR`, the weakest at least `maxR / 2`
 * (a destroyed, zero-weight city keeps one small hexagon). Every next
 * hexagon tries the six contact spots of every placed hexagon and takes the
 * one closest to the centre that does not overlap anything — the cluster
 * grows as a tight rug of flush neighbours, never a scattered field.
 */
export function hexClusters(
  weights: number[],
  box: { w: number; h: number },
  opts: { maxR?: number } = {},
): Cluster[] {
  if (weights.length === 0) return []

  const maxR = opts.maxR ?? 60
  const wMax = Math.max(...weights, 0)
  // √ of the weight: area, not radius, should follow the stats («размер
  // складывался из объёма уровня жизни и развития»).
  const radiusOf = (w: number) => {
    if (wMax <= 0) return maxR / 2 // round one: everything at 0.00 % — equal hexagons
    const t = Math.sqrt(Math.max(w, 0) / wMax)
    return Math.max(maxR / 2, maxR * t)
  }

  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w || a.i - b.i)
  const placed: { cx: number; cy: number; r: number; i: number }[] = []

  for (const { w, i } of order) {
    const r = radiusOf(w)
    let best: { cx: number; cy: number; d: number } | null = null
    // First hexagon sits in the centre; the rest test every contact spot.
    if (placed.length === 0) {
      best = { cx: 0, cy: 0, d: 0 }
    } else {
      for (const p of placed) {
        for (let k = 0; k < 6; k++) {
          const theta = (Math.PI / 3) * k
          const d = reach(p.r, theta) + reach(r, theta + Math.PI)
          const cx = p.cx + d * Math.cos(theta)
          const cy = p.cy + d * Math.sin(theta)
          // No overlap with anything: the centre must stay one full flat-pair
          // away from every other hexagon (a small tolerance keeps flush
          // neighbours from rounding against each other).
          // Exact no-overlap test along the actual direction φ: two hexagons
          // overlap only if the centres sit closer than their reaches sum.
          // (A constant bound would wrongly reject flush vertical stacks.)
          const clear = placed.every((q) => {
            if (q === p) return true
            const dist = Math.hypot(cx - q.cx, cy - q.cy)
            if (dist === 0) return false
            const phi = Math.atan2(cy - q.cy, cx - q.cx)
            return dist >= reach(q.r, phi) + reach(r, phi + Math.PI) - 0.01
          })
          if (!clear) continue
          const dist = Math.hypot(cx, cy)
          if (!best || dist < best.d - 1e-9) best = { cx, cy, d: dist }
        }
      }
    }
    const spot = best ?? { cx: 0, cy: 0, d: 0 }
    placed.push({ cx: spot.cx, cy: spot.cy, r, i })
  }

  // Fit the cluster into the box: one uniform scale, then centre it. The
  // bounding box uses the real reach of each hexagon, corners included.
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const h of placed) {
    // Pointy-top: corners reach r vertically (vertex up/down) and r·cos(30°)
    // horizontally (the flats face left and right).
    minX = Math.min(minX, h.cx - h.r * FLAT)
    maxX = Math.max(maxX, h.cx + h.r * FLAT)
    minY = Math.min(minY, h.cy - h.r)
    maxY = Math.max(maxY, h.cy + h.r)
  }
  const pad = 6
  const scale = Math.min((box.w - pad * 2) / (maxX - minX), (box.h - pad * 2) / (maxY - minY))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  return weights.map((_, i) => {
    const h = placed.find((p) => p.i === i)!
    const hex: Hex = {
      cx: (h.cx - midX) * scale + box.w / 2,
      cy: (h.cy - midY) * scale + box.h / 2,
      r: h.r * scale,
    }
    return { cells: [hex], cx: hex.cx, cy: hex.cy }
  })
}
