/**
 * The projector charts, drawn with recharts («давай нормальный фреймворк,
 * красивый, чтобы можно было выделять объекты»).
 *
 * What the hand-rolled SVG could not do and these can: a crosshair tooltip
 * that follows the mouse, a legend that highlights or hides a country, and a
 * brush strip that windows the whole round history. The explicit width/height
 * (not ResponsiveContainer) keeps the charts renderable in jsdom tests and
 * lets CSS stretch them to the projector.
 */
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { COLORS, colorOf } from './colors'
import type { Point, Series } from './core'

const W = 720
const H = 300

/** One row per round with every country as a column — the shape recharts eats. */
function rowsOf(series: Series[]): Record<string, number>[] {
  const rounds = [...new Set(series.flatMap((s) => s.points.map((p) => p.round)))].sort(
    (a, b) => a - b,
  )
  const byRound = new Map<string, number>()
  for (const s of series) for (const p of s.points) byRound.set(`${s.id}|${p.round}`, p.value)
  return rounds.map((r) => {
    const row: Record<string, number> = { round: r }
    for (const s of series) {
      const v = byRound.get(`${s.id}|${r}`)
      if (v != null) row[s.id] = v
    }
    return row
  })
}

const tooltipStyle = {
  background: 'var(--card, #fff)',
  border: '1px solid rgb(0 0 0 / 0.15)',
  borderRadius: 8,
  fontSize: 13,
}

/** Average life level of every country, one line each — the scoreboard over time. */
export function LifeChart({ series }: { series: Series[] }) {
  const rows = useMemo(() => rowsOf(series), [series])
  // The legend highlights (hover) and hides (click) a country — «выделять
  // объекты». Hidden series keep their place in the data, just leave the plot.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hot, setHot] = useState<string | null>(null)

  const toggle = (id: string) =>
    setHidden((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div
      className="chart-card"
      data-testid="life-chart"
      role="img"
      aria-label="Уровень жизни стран"
    >
      <LineChart
        width={W}
        height={H}
        data={rows}
        margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(128 128 128 / 0.25)" />
        <XAxis dataKey="round" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R${v}`} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${Math.round(v / 100)} %`} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `Раунд ${l}`}
          formatter={(v) => [`${((v as number) / 100).toFixed(2)} %`, undefined]}
        />
        {series.map((s, i) => {
          const off = hidden.has(s.id)
          const dim = (hot != null && hot !== s.id && !off) || off
          return (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.name}
              stroke={colorOf(i)}
              strokeWidth={hot === s.id ? 3.5 : 2}
              strokeOpacity={dim ? 0.25 : 1}
              dot={{ r: 2.5 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
              hide={off}
            />
          )
        })}
        {/* The round history strip: drag the window over the rounds the room
            wants to see — «чтобы была история раундов в том числе». */}
        <Brush dataKey="round" height={26} travellerWidth={10} stroke={COLORS[2]} y={H - 30} />
      </LineChart>

      {/* Own HTML legend, not recharts': it must highlight on hover and hide on
          click («выделять объекты») — and recharts' legend swallows the whole
          plot body in jsdom. Same colours as the lines, same order. */}
      <ul className="legend chart-legend">
        {series.map((s) => {
          const off = hidden.has(s.id)
          return (
            <li
              key={s.id}
              role="button"
              aria-pressed={!off}
              className={off ? 'off' : hot === s.id ? 'hot' : undefined}
              onMouseEnter={() => setHot(s.id)}
              onMouseLeave={() => setHot(null)}
              onClick={() => toggle(s.id)}
            >
              <span className="swatch" style={{ background: colorOf(series.indexOf(s)) }} />
              {s.name}
              <strong>{((s.points[s.points.length - 1]?.value ?? 0) / 100).toFixed(2)} %</strong>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** World ecology over the game: one area, 0–100 %, with the danger zone shaded. */
export function EcologyChart({ points }: { points: Point[] }) {
  const rows = useMemo(() => points.map((p) => ({ round: p.round, eco: p.value })), [points])
  return (
    <div className="chart-card" data-testid="ecology-chart" role="img" aria-label="Экология мира">
      <AreaChart
        width={W}
        height={H}
        data={rows}
        margin={{ top: 12, right: 18, bottom: 4, left: 0 }}
      >
        <defs>
          <linearGradient id="eco-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORS[2]} stopOpacity={0.45} />
            <stop offset="100%" stopColor={COLORS[2]} stopOpacity={0.06} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(128 128 128 / 0.25)" />
        <XAxis dataKey="round" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `R${v}`} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(v: number) => `${v} %`} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(l) => `Раунд ${l}`}
          formatter={(v) => [`${(v as number).toFixed(2)} %`, 'Экология']}
        />
        {/* Below 40 % the planet is in trouble: the zone stays shaded. */}
        <ReferenceArea y1={0} y2={40} fill="rgb(200 60 60 / 0.12)" />
        <ReferenceLine y={40} stroke="rgb(200 60 60 / 0.7)" strokeDasharray="4 3" />
        <Area
          type="monotone"
          dataKey="eco"
          name="Экология"
          stroke={COLORS[2]}
          strokeWidth={2.5}
          fill="url(#eco-fill)"
          dot={{ r: 2.5 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </div>
  )
}

/** What the countries spent the game doing, as horizontal bars (HTML is fine here). */
export function DeedsChart({ slices }: { slices: { id: string; label: string; count: number }[] }) {
  const top = Math.max(...slices.map((s) => s.count), 1)
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
export function StandingsLegend({ series }: { series: Series[] }) {
  return (
    <ul className="legend" aria-label="Итоги раунда">
      {series.map((s, i) => (
        <li key={s.id}>
          <span className="swatch" style={{ background: colorOf(i) }} />
          {s.name}
          <strong>{(s.points[s.points.length - 1]?.value ?? 0).toFixed(1)} %</strong>
        </li>
      ))}
    </ul>
  )
}
