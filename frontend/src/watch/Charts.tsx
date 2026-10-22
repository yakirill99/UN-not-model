/**
 * Charts drawn as plain SVG.
 *
 * A charting library would add half a megabyte to a 292 KB bundle for three simple
 * pictures. These are a few dozen lines each, render in jsdom without canvas mocks,
 * and scale with the projector because SVG has no fixed pixel size.
 */
import { COLORS, colorOf } from './colors'
import type { Point, Series, Slice } from './core'
import { last, scale } from './core'

const W = 320
const H = 160
const PAD = 24

/** Round number -> x, value -> y, with the value axis fixed so charts stay comparable. */
function project(points: Point[], top: number): string {
  if (points.length === 0) return ''
  const lastRound = Math.max(1, points[points.length - 1].round)
  return points
    .map((p) => {
      const x = PAD + (p.round / lastRound) * (W - PAD * 2)
      const y = H - PAD - (p.value / top) * (H - PAD * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** World ecology over the game: one line, 0–100 %, with the danger zone shaded. */
export function EcologyChart({ points }: { points: Point[] }) {
  const y = (v: number) => H - PAD - (v / 100) * (H - PAD * 2)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Экология мира">
      <rect x={PAD} y={y(40)} width={W - PAD * 2} height={H - PAD - y(40)} className="zone-bad" />
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="axis" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="axis" />
      <text x={2} y={y(100) + 4} className="tick">
        100
      </text>
      <text x={2} y={y(0) + 4} className="tick">
        0
      </text>
      {points.length > 1 && (
        <polyline points={project(points, 100)} className="line" style={{ stroke: COLORS[2] }} />
      )}
      {points.map((p: Point) => (
        <circle
          key={p.round}
          cx={PAD + (p.round / Math.max(1, points[points.length - 1].round)) * (W - PAD * 2)}
          cy={y(p.value)}
          r={2.5}
          style={{ fill: COLORS[2] }}
        >
          <title>{`Раунд ${p.round}: ${p.value} %`}</title>
        </circle>
      ))}
    </svg>
  )
}

/** Average life level of every country, one line each — the scoreboard over time. */
export function LifeChart({ series }: { series: Series[] }) {
  const top = scale(series.flatMap((s) => s.points.map((p) => p.value)))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Уровень жизни стран">
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="axis" />
      <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="axis" />
      <text x={2} y={PAD + 4} className="tick">
        {Math.round(top)}
      </text>
      {series.map((s, i) => (
        <polyline
          key={s.id}
          points={project(s.points, top)}
          className="line"
          style={{ stroke: colorOf(i) }}
        >
          <title>{`${s.name}: ${last(s.points).toFixed(1)} %`}</title>
        </polyline>
      ))}
    </svg>
  )
}

/** What the countries spent the game doing, as horizontal bars. */
export function DeedsChart({ slices }: { slices: Slice[] }) {
  const top = scale(slices.map((s) => s.count))
  return (
    <div className="bars">
      {slices.map((s, i) => (
        <div key={s.id} className="bar-row">
          <span className="bar-label">{s.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${(s.count / top) * 100}%`, background: colorOf(i) }}
            />
          </span>
          <span className="bar-value">{s.count}</span>
        </div>
      ))}
    </div>
  )
}

/** The legend doubles as the standings: sorted, with the final number spelled out. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="legend">
      {series.map((s, i) => (
        <li key={s.id}>
          <span className="swatch" style={{ background: colorOf(i) }} />
          {s.name}
          <strong>{last(s.points).toFixed(1)} %</strong>
        </li>
      ))}
    </ul>
  )
}
