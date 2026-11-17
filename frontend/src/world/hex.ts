/**
 * The territory of our state as a true honeycomb: a grid of identical cells,
 * packed edge to edge — «чтобы они друг с другом соприкасались». A city claims
 * one contiguous wedge of the honeycomb; the number of cells follows the
 * city's weight — «размер складывался из объёма уровня жизни и развития». The
 * biggest city grows from the centre, the others claim the adjacent cells —
 * and because claims are consecutive runs of one angular sweep, the blobs
 * never interleave («ромбы наслоены друг на друга» was the verdict on the
 * previous packer, whose blobs mixed into one field). A destroyed city keeps
 * one small red cell instead of vanishing.
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

/** One city's territory: its cells plus the centre the label sits on. */
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

/** Cube-distance from the origin: the ring a cell sits on. */
function ringOf(q: number, row: number): number {
  return Math.max(Math.abs(q), Math.abs(row), Math.abs(q + row))
}

/** Cells within complete rings 0..R: 1 + 3R(R+1). */
function cellsWithin(rings: number): number {
  return 1 + 3 * rings * (rings + 1)
}

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
 * Returns one cluster per value, in the same order.
 *
 * The honeycomb is grown ring by ring from the centre; the cells are read in
 * one angular sweep (ring by ring, each ring from angle −π to +π) and dealt
 * out as consecutive runs to the cities in weight order. The biggest city gets
 * the first run — the centre — and every next city claims the adjacent cells:
 * every cluster is contiguous, the clusters never interleave and sit edge to
 * edge, «рядом друг с другом».
 */
export function hexClusters(
  weights: number[],
  box: { w: number; h: number },
  opts: { perCity?: number; maxCells?: number } = {},
): Cluster[] {
  if (weights.length === 0) return []

  const perCity = opts.perCity ?? 6
  const maxCells = opts.maxCells ?? 400
  const desired = Math.max(weights.length, Math.min(maxCells, weights.length * perCity))
  // Whole rings only: a truncated outer ring would read as a bitten-off edge.
  // The smallest full-ring honeycomb that fits the desired grain.
  let rings = 0
  while (cellsWithin(rings) < desired) rings++
  const total = cellsWithin(rings)

  const ks = cellsPerCity(weights, total)

  // The sweep: every cell of the honeycomb, ring by ring, each ring sorted by
  // the angle of its centre. Consecutive cells of the sweep always touch, so a
  // run of them is a contiguous blob and two runs are neighbouring territories.
  const sweep: { q: number; row: number }[] = []
  for (let ring = 0; ring <= rings; ring++) {
    const cells: { q: number; row: number; angle: number }[] = []
    for (let q = -ring; q <= ring; q++) {
      for (let row = -ring; row <= ring; row++) {
        if (ringOf(q, row) !== ring) continue
        const { x, y } = cellCentre(q, row)
        cells.push({ q, row, angle: Math.atan2(y, x) })
      }
    }
    cells.sort((a, b) => a.angle - b.angle || a.q - b.q)
    sweep.push(...cells.map((c) => ({ q: c.q, row: c.row })))
  }

  // Deal the cells out: cities in weight order take consecutive runs.
  const owner = new Map<string, number>()
  const cells: { cx: number; cy: number; q: number; row: number }[][] = weights.map(() => [])
  let cursor = 0
  const order = weights.map((w, i) => ({ w, i })).sort((a, b) => b.w - a.w || a.i - b.i)
  for (const { i } of order) {
    for (let n = 0; n < ks[i]; n++) {
      const { q, row } = sweep[cursor++]
      owner.set(`${q},${row}`, i)
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
      const other = owner.get(`${nq},${nr}`)
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
    // The label sits on the blob's bounding-box centre — for a whole-city map
    // that is the centre of the card, and for a wedge it is inside the wedge.
    const cx = (Math.min(...blob.map((c) => c.cx)) + Math.max(...blob.map((c) => c.cx))) / 2
    const cy = (Math.min(...blob.map((c) => c.cy)) + Math.max(...blob.map((c) => c.cy))) / 2
    return { cells: blob, cx, cy }
  })
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
