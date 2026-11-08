/**
 * Squarified treemap (Bruls, Huizing & van Wijk): one container rectangle cut
 * into cells whose areas follow their values and whose shapes stay close to
 * squares. The «Мир» tab uses it to lay the cities of our state out —
 * «чем большее значение несёт город, тем больше фигура».
 *
 * Pure geometry — no dependencies, deterministic output.
 */

export type Rect = { x: number; y: number; w: number; h: number }

/** Worst aspect ratio of a row of cells with total area `area` on side `len`. */
function worst(row: number[], area: number, len: number): number {
  const max = Math.max(...row)
  const min = Math.min(...row)
  const s2 = area * area
  const l2 = len * len
  return Math.max((l2 * max) / s2, s2 / (l2 * min))
}

/**
 * Lay the values out inside the container. Returns one rect per value, in the
 * same order; cell areas are proportional to the weights. Zero and negative
 * values are lifted to a small floor so a destroyed or bankrupt city still
 * gets a visible sliver instead of vanishing.
 */
export function squarify(container: Rect, values: number[]): Rect[] {
  if (values.length === 0) return []
  const total = values.reduce((s, v) => s + Math.max(v, 0), 0)
  const floor = total > 0 ? total * 0.004 : 1
  const weights = values.map((v) => Math.max(v, floor))

  const out: Rect[] = new Array(values.length)
  let free = { ...container }
  let from = 0

  while (from < weights.length) {
    // The shorter side of the free rectangle carries the next row.
    const horizontal = free.w <= free.h
    const len = horizontal ? free.w : free.h
    const areaTotal = free.w * free.h
    const restTotal = weights.slice(from).reduce((s, v) => s + v, 0)

    // Grow the row while it improves the worst aspect ratio.
    const row: number[] = []
    let rowWeight = 0
    let best = Number.POSITIVE_INFINITY
    let i = from
    while (i < weights.length) {
      const candidate = [...row, weights[i]]
      const candidateWeight = rowWeight + weights[i]
      const ratio = worst(candidate, (candidateWeight / restTotal) * areaTotal, len)
      if (row.length > 0 && ratio > best) break
      best = ratio
      row.push(weights[i])
      rowWeight = candidateWeight
      i += 1
    }

    const rowArea = (rowWeight / restTotal) * areaTotal
    const thick = rowArea / len
    let offset = 0
    for (let j = 0; j < row.length; j++) {
      const along = (row[j] / rowWeight) * len
      out[from + j] = horizontal
        ? { x: free.x + offset, y: free.y, w: along, h: thick }
        : { x: free.x, y: free.y + offset, w: thick, h: along }
      offset += along
    }

    from += row.length
    if (horizontal) {
      free = { ...free, y: free.y + thick, h: free.h - thick }
    } else {
      free = { ...free, x: free.x + thick, w: free.w - thick }
    }
  }
  return out
}
