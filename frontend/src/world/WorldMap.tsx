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
}: {
  me: Me
  others: Foreign[]
  relations: Relations
  selectedId: string | null
  onSelect: (id: string) => void
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
