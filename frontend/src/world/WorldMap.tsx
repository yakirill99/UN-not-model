import { useEffect, useMemo, useState } from 'react'
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { Schemas } from '../api/client'
import { relationOf, type Relation, type Relations } from './diplomacy'
import { geoOf, numOf } from './geo'
import { loadWorld, type CountryFeature } from './worldData'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

const W = 960
const H = 520

const RELATION_WORD: Record<Relation, string> = {
  friend: 'друг',
  neutral: 'нейтрал',
  enemy: 'враг',
}

type Player = {
  id: string
  name: string
  relation: Relation
  own: boolean
  feature?: CountryFeature
  /** Label anchor in projected coordinates (undefined → goes to the strip). */
  at?: { x: number; y: number }
}

/** One strike of the round to draw as a flying arc (#17, the CFR-tracker ask). */
export type StrikeMark = {
  id: string
  /** Country id of the target city; resolved against the players of the game. */
  toId: string
  outcome: 'absorbed' | 'destroyed' | 'already_destroyed'
  /** True when we fired it: the arc starts from our borders, otherwise
      it falls from the top edge — the engine hides the author (section 11). */
  fromMe: boolean
}

/** A quad bezier that bows above the straight line: a trajectory, not a wire. */
function arcPath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const lift = Math.min(90, len * 0.35)
  let ox = -dy / len
  let oy = dx / len
  if (oy > 0) {
    ox = -ox
    oy = -oy
  }
  const cx = (a.x + b.x) / 2 + ox * lift
  const cy = (a.y + b.y) / 2 + oy * lift
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

/**
 * The world map of the «Мир» tab (#world) with real country borders
 * (world-atlas 1:50m). The attitude to us is drawn as the outline of the
 * country itself — синий — мы, зелёный — друзья, серый — нейтралы,
 * красный — враги — not as a dot on the map. Clicking a country opens its
 * card; relations stay manual (see diplomacy.ts).
 *
 * A game country the atlas does not know (or that has no numeric code) still
 * shows up: those go to an index strip under the map instead of vanishing.
 */
export default function WorldMap({
  me,
  others,
  relations,
  selectedId,
  onSelect,
  strikes = [],
}: {
  me: Me
  others: Foreign[]
  relations: Relations
  selectedId: string | null
  onSelect: (id: string) => void
  strikes?: StrikeMark[]
}) {
  const [world, setWorld] = useState<CountryFeature[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    loadWorld()
      .then((w) => {
        if (live) setWorld(w)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  const projection = useMemo(() => {
    if (!world) return null
    return geoNaturalEarth1().fitExtent(
      [
        [6, 6],
        [W - 6, H - 6],
      ],
      { type: 'FeatureCollection', features: world },
    )
  }, [world])

  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection])

  if (!world || !projection || !path) {
    return (
      <p className="muted world-map-status" role="status">
        {failed
          ? 'Карта мира не загрузилась — проверьте соединение и обновите страницу.'
          : 'Загружаем карту мира…'}
      </p>
    )
  }

  // Players of the game → features of the atlas; unmatched ones go to the strip.
  const players: Player[] = [
    { id: me.id, name: me.name, relation: 'neutral', own: true }, // цвет даёт класс .us
    ...others.map((c) => ({
      id: c.id,
      name: c.name,
      relation: relationOf(relations, c.id),
      own: false,
    })),
  ]
  for (const p of players) {
    const num = numOf(p.name)
    p.feature = num ? world.find((f) => String(f.id) === num) : undefined
    const geo = geoOf(p.name)
    if (geo && p.feature) {
      const [x, y] = projection([geo.lon, geo.lat]) ?? []
      if (x != null && y != null) p.at = { x, y }
    }
  }
  const strip = players.filter((p) => !p.feature)

  return (
    <svg
      className="world-map"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Карта мира: мы — ${me.name}, плюс ${others.length} стран`}
    >
      <rect className="ocean" x={0} y={0} width={W} height={H} />
      <path className="graticule" d={path(geoGraticule10()) ?? undefined} />

      {world.map((f, i) => (
        <path key={`land-${i}`} className="land" d={path(f) ?? undefined} />
      ))}

      {/* The countries of the game: the relation is the border outline itself. */}
      {players
        .filter((p) => p.feature)
        .map((p) => (
          <path
            key={p.id}
            className={`ctr ${p.own ? 'us' : p.relation}${selectedId === p.id ? ' sel' : ''}`}
            d={path(p.feature!) ?? undefined}
            role="button"
            aria-label={`${p.name} на карте${p.own ? ' (это мы)' : ` — ${RELATION_WORD[p.relation]}`}`}
            aria-pressed={selectedId === p.id}
            onClick={() => onSelect(p.id)}
          />
        ))}

      {/* Names of the game countries only — the rest of the world stays quiet. */}
      {players
        .filter((p) => p.at)
        .map((p) => (
          <text key={`lbl-${p.id}`} className="lbl" x={p.at!.x} y={p.at!.y}>
            {p.name}
          </text>
        ))}

      {/* The round's nuclear strikes: an arc into the target and a flash ring
          on it — «визуализация прилетов ракет». Traces stay for the round. */}
      {strikes.length > 0 && (
        <g className="strikes" aria-label={`Ядерные удары за раунд: ${strikes.length}`}>
          {strikes.map((s) => {
            const target = players.find((p) => p.id === s.toId)
            if (!target?.at) return null // a country without borders cannot host an arc
            const fromMe = s.fromMe ? players.find((p) => p.own)?.at : undefined
            const from = fromMe ?? { x: target.at.x, y: -8 }
            return (
              <g key={s.id}>
                <path className={`arc ${s.outcome}`} d={arcPath(from, target.at)} />
                <circle className={`boom ${s.outcome}`} cx={target.at.x} cy={target.at.y} r={9} />
              </g>
            )
          })}
        </g>
      )}

      {/* Countries without a shape on the atlas: an index strip along the bottom. */}
      {strip.length > 0 && (
        <g aria-label="Страны без границ на карте">
          {strip.map((p, i) => {
            const x = strip.length === 1 ? W / 2 : 80 + (i * (W - 160)) / (strip.length - 1)
            return (
              <g
                key={p.id}
                role="button"
                aria-label={`${p.name} на карте${p.own ? ' (это мы)' : ` — ${RELATION_WORD[p.relation]}`}`}
                aria-pressed={selectedId === p.id}
                onClick={() => onSelect(p.id)}
              >
                <rect
                  className={`chip ${p.own ? 'us' : p.relation}${selectedId === p.id ? ' sel' : ''}`}
                  x={x - p.name.length * 2.6 - 8}
                  y={H - 26}
                  width={p.name.length * 5.2 + 16}
                  height={18}
                  rx={9}
                />
                <text className="lbl chip-lbl" x={x} y={H - 13}>
                  {p.name}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}
