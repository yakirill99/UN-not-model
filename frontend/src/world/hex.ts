/**
 * Honeycomb layout for the «Мои города на карте» card (#world): one hexagon
 * per city, packed around the centre; a hexagon's area follows the city's
 * life level — «чем большее значение несёт город, тем больше фигура».
 * A destroyed (zero-weight) city keeps a small visible hexagon instead of
 * vanishing.
 *
 * Pure geometry — no dependencies, deterministic output: same weights, same
 * picture, on every machine and every reload.
 */

export type Hex = { cx: number; cy: number; r: number }

const SQRT3_2 = Math.sqrt(3) / 2

/** Corner points of a flat-top hexagon, ready for <polygon points>. */
export function hexPoints(hex: Hex): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i
    pts.push(
      `${(hex.cx + hex.r * Math.cos(a)).toFixed(2)},${(hex.cy + hex.r * Math.sin(a)).toFixed(2)}`,
    )
  }
  return pts.join(' ')
}

/** Bounding box of one hexagon (flat-top: width 2r, height √3·r). */
function extent(hex: Hex) {
  return {
    minX: hex.cx - hex.r,
    maxX: hex.cx + hex.r,
    minY: hex.cy - hex.r * SQRT3_2,
    maxY: hex.cy + hex.r * SQRT3_2,
  }
}

/**
 * Lay the weights out as a honeycomb inside the box. Returns one hexagon per
 * value, in the same order. Zero and negative values are lifted to a small
 * floor so a destroyed city still gets a visible cell instead of vanishing.
 * `gap` is the breathing room BETWEEN neighbouring hexagons, as a fraction of
 * their combined radii — absolute pixels would vanish after the fit-to-box
 * scale or, worse, tear the clump apart (the first cut had a 6-px gap on
 * unit radii and the cities floated far apart).
 */
export function hexLayout(values: number[], box: { w: number; h: number }, gap = 0.18): Hex[] {
  if (values.length === 0) return []

  const total = values.reduce((s, v) => s + Math.max(v, 0), 0)
  const floor = total > 0 ? total * 0.02 : 1
  const weights = values.map((v) => Math.max(v, floor))
  const max = Math.max(...weights)
  // Area of a hexagon grows like r², so radius grows like √value.
  const radii = weights.map((v) => Math.sqrt(v / max))

  // Biggest first from the centre out: every next hexagon takes the free
  // contact spot closest to the centre — a compact, predictable clump.
  const order = radii.map((r, i) => ({ r, i })).sort((a, b) => b.r - a.r || a.i - b.i)
  const placed: Hex[] = new Array(values.length)
  const cluster: Hex[] = []

  for (const { r: unit, i } of order) {
    if (cluster.length === 0) {
      const hex = { cx: 0, cy: 0, r: unit }
      placed[i] = hex
      cluster.push(hex)
      continue
    }
    // Candidates: the six contact directions around every placed hexagon.
    let best: Hex | null = null
    let bestScore = Number.POSITIVE_INFINITY
    for (const p of cluster) {
      for (let k = 0; k < 6; k++) {
        const a = (Math.PI / 3) * k
        const spacing = (p.r + unit) * (1 + gap)
        const cand: Hex = {
          cx: p.cx + spacing * Math.cos(a),
          cy: p.cy + spacing * Math.sin(a),
          r: unit,
        }
        let overlaps = false
        for (const q of cluster) {
          if (q === p) continue
          const d = Math.hypot(cand.cx - q.cx, cand.cy - q.cy)
          if (d < (cand.r + q.r) * (1 + gap) - 0.01) {
            overlaps = true
            break
          }
        }
        if (overlaps) continue
        // Closest to the centre wins; the angle breaks ties deterministically.
        const score = Math.hypot(cand.cx, cand.cy) * 1000 + k
        if (score < bestScore) {
          bestScore = score
          best = cand
        }
      }
    }
    const hex = best ?? {
      // Unreachable in practice (a ring around one hexagon always has a free
      // spot) — but a fallback must still not overlap what is already there.
      cx: Math.max(...cluster.map((h) => h.cx + h.r)) * (1 + gap) + unit,
      cy: 0,
      r: unit,
    }
    placed[i] = hex
    cluster.push(hex)
  }

  // Fit the cluster into the box: one uniform scale, then centre it.
  const bb = cluster.map(extent).reduce((a, b) => ({
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  }))
  const pad = 4
  const scale = Math.min(
    (box.w - pad * 2) / (bb.maxX - bb.minX),
    (box.h - pad * 2) / (bb.maxY - bb.minY),
  )
  const midX = (bb.minX + bb.maxX) / 2
  const midY = (bb.minY + bb.maxY) / 2
  return placed.map((h) => ({
    cx: (h.cx - midX) * scale + box.w / 2,
    cy: (h.cy - midY) * scale + box.h / 2,
    r: h.r * scale,
  }))
}
