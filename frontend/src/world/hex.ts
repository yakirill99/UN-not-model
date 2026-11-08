/**
 * The territory of our state as a true honeycomb: a grid of identical cells,
 * packed edge to edge — «чтобы они друг с другом соприкасались». A city claims
 * a contiguous blob of cells; the number of cells follows the city's weight —
 * «размер складывался из объёма уровня жизни и развития». A destroyed city
 * keeps one small red cell instead of vanishing.
 *
 * Pure geometry — no dependencies, deterministic output: same weights, same
 * picture, on every machine and every reload.
 */

export type Hex = { cx: number; cy: number; r: number }

/**
 * One cell of a city's territory. `edges` lists the sides that face ANOTHER
 * city or the void — each as [x1, y1, x2, y2], ready for a <line>: the borders
 * a map needs to tell neighbouring territories apart.
 */
export type Cell = Hex & { edges: [number, number, number, number][] }

/** One city's territory: its cells plus the centroid the label sits on. */
export type Cluster = { cells: Cell[]; cx: number; cy: number }

const SQRT3 = Math.sqrt(3)

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

/** Axial coordinates of a flat-top cell → its centre in units of r. */
function cellCentre(q: number, row: number): { x: number; y: number } {
  return { x: 1.5 * q, y: SQRT3 * (row + q / 2) }
}

/** The six axial neighbours of a cell. */
const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]

/** Cells per city, proportional to weight: a destroyed (zero) city gets one. */
function cellsPerCity(weights: number[], total: number): number[] {
  const sum = weights.reduce((s, w) => s + Math.max(w, 0), 0)
  const ks = weights.map((w) => (w > 0 && sum > 0 ? Math.max(1, Math.round((total * w) / sum)) : 1))
  // Even a tiny live city deserves more than a ruin: lift every live city to 2.
  for (let i = 0; i < ks.length; i++) if (weights[i] > 0 && ks[i] < 2) ks[i] = 2
  // Match the sum to `total` by nudging the largest cities first.
  let diff = total - ks.reduce((s, k) => s + k, 0)
  const bySize = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w || a.i - b.i)
  while (diff !== 0 && bySize.length > 0) {
    for (const { i } of bySize) {
      if (diff === 0) break
      if (diff > 0 || ks[i] > 1) {
        ks[i] += diff > 0 ? 1 : -1
        diff += diff > 0 ? -1 : 1
      }
    }
  }
  return ks
}

/**
 * Lay the weights out as a honeycomb of identical cells inside the box.
 * Returns one cluster per value, in the same order. The biggest weight grows
 * from the centre; every next cell joins its own city's frontier, so each
 * cluster is contiguous and the clusters touch edge to edge.
 *
 * The cell count follows the city count (`perCity` cells per city, by
 * default): few cities — a bold honeycomb, many — fine grain. `maxCells`
 * caps the DOM size on absurd scenarios.
 */
export function hexClusters(
  weights: number[],
  box: { w: number; h: number },
  opts: { perCity?: number; maxCells?: number } = {},
): Cluster[] {
  if (weights.length === 0) return []

  const perCity = opts.perCity ?? 14
  const maxCells = opts.maxCells ?? 400
  const total = Math.max(weights.length, Math.min(maxCells, weights.length * perCity))

  const ks = cellsPerCity(weights, total)

  // Greedy flood: cities in weight order, each cell from the city's own
  // frontier, closest to the centre first — a compact connected blob per city.
  const owner = new Map<string, number>()
  const frontier = weights.map(() => new Map<string, [number, number]>())
  const key = (q: number, row: number) => `${q},${row}`

  const addFrontier = (city: number, q: number, row: number) => {
    for (const [dq, dr] of NEIGHBOURS) {
      const nq = q + dq
      const nr = row + dr
      const k = key(nq, nr)
      if (!owner.has(k) && !frontier[city].has(k)) frontier[city].set(k, [nq, nr])
    }
  }

  const takeCell = (city: number): [number, number] => {
    let best: [number, number] | null = null
    let bestDist = Number.POSITIVE_INFINITY
    let bestAngle = 0
    for (const qr of frontier[city].values()) {
      const { x, y } = cellCentre(qr[0], qr[1])
      const dist = Math.hypot(x, y)
      const angle = Math.atan2(y, x)
      if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) <= 1e-9 && angle < bestAngle)) {
        best = qr
        bestDist = dist
        bestAngle = angle
      }
    }
    if (best) return best
    // Frontier empty (a city the others fully surround — only for tiny maps):
    // take the free cell closest to the centre, wherever it is.
    let free: [number, number] | null = null
    let freeDist = Number.POSITIVE_INFINITY
    for (let ring = 0; ring < 64 && free == null; ring++) {
      for (let q = -ring; q <= ring && free == null; q++) {
        for (let row = -ring; row <= ring && free == null; row++) {
          if (Math.max(Math.abs(q), Math.abs(row), Math.abs(q + row)) !== ring) continue
          if (owner.has(key(q, row))) continue
          const d = Math.hypot(cellCentre(q, row).x, cellCentre(q, row).y)
          if (d < freeDist) {
            free = [q, row]
            freeDist = d
          }
        }
      }
    }
    return free ?? [0, 0]
  }

  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w || a.i - b.i)
  const cells: { cx: number; cy: number; q: number; row: number }[][] = weights.map(() => [])
  for (const { i } of order) {
    for (let n = 0; n < ks[i]; n++) {
      const [q, row] = takeCell(i)
      owner.set(key(q, row), i)
      frontier[i].delete(key(q, row))
      addFrontier(i, q, row)
      const { x, y } = cellCentre(q, row)
      cells[i].push({ cx: x, cy: y, q, row })
    }
  }

  // Fit the whole honeycomb into the box: one uniform scale keeps the cells
  // regular and edge to edge; then centre it.
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const blob of cells) {
    for (const c of blob) {
      minX = Math.min(minX, c.cx - 1)
      maxX = Math.max(maxX, c.cx + 1)
      minY = Math.min(minY, c.cy - SQRT3 / 2)
      maxY = Math.max(maxY, c.cy + SQRT3 / 2)
    }
  }
  const pad = 4
  const scale = Math.min((box.w - pad * 2) / (maxX - minX), (box.h - pad * 2) / (maxY - minY))
  const midX = (minX + maxX) / 2
  const midY = (minY + maxY) / 2

  const px = (x: number) => (x - midX) * scale + box.w / 2
  const py = (y: number) => (y - midY) * scale + box.h / 2

  // Border sides: a face whose neighbour belongs to another city (or none).
  // Drawn as short lines across the shared edge — the map reads as territories.
  const bordersOf = (city: number, q: number, row: number): [number, number, number, number][] => {
    const c = cellCentre(q, row)
    const edges: [number, number, number, number][] = []
    for (const [dq, dr] of NEIGHBOURS) {
      const nq = q + dq
      const nr = row + dr
      const other = owner.get(key(nq, nr))
      if (other === city) continue
      const n = cellCentre(nq, nr)
      const mx = (px(c.x) + px(n.x)) / 2
      const my = (py(c.y) + py(n.y)) / 2
      // Perpendicular to the line towards the neighbour, half a side long.
      let dx = px(n.x) - px(c.x)
      let dy = py(n.y) - py(c.y)
      const len = Math.hypot(dx, dy) || 1
      dx /= len
      dy /= len
      const half = scale / 2
      edges.push([mx - dy * half, my + dx * half, mx + dy * half, my - dx * half])
    }
    return edges
  }

  return weights.map((_, i) => {
    const blob: Cell[] = cells[i].map((c) => ({
      cx: px(c.cx),
      cy: py(c.cy),
      r: scale,
      edges: bordersOf(i, c.q, c.row),
    }))
    const cx = blob.reduce((s, c) => s + c.cx, 0) / blob.length
    const cy = blob.reduce((s, c) => s + c.cy, 0) / blob.length
    return { cells: blob, cx, cy }
  })
}
