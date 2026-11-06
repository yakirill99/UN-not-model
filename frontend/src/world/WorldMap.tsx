import type { Schemas } from '../api/client'
import { relationOf, type Relation, type Relations } from './diplomacy'
import { geoOf, project, MAP_W, MAP_H } from './geo'
import { LAND, SEAS } from './continents'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

const W = MAP_W
const H = MAP_H

const RELATION_WORD: Record<Relation, string> = {
  friend: 'друг',
  neutral: 'нейтрал',
  enemy: 'враг',
}

type Marker = {
  id: string
  name: string
  life: number
  relation: Relation
  own: boolean
  x: number
  y: number
}

/**
 * The stylized world map of the «Мир» tab (#world): every country of the game
 * is a marker sized by its average life level, painted by its relation to us —
 * синий — мы, зелёный — друзья, серый — нейтралы, красный — враги — and linked
 * to our marker. Relations are manual (see diplomacy.ts); the mechanics of
 * who-is-who is a later game feature.
 *
 * A country the geo table does not know still shows up: those go to an index
 * strip under the map instead of a random spot in an ocean.
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
  const maxLife = Math.max(me.average_life_level, ...others.map((c) => c.average_life_level), 100)
  const radius = (life: number) => 4.5 + 8 * Math.sqrt(life / maxLife)

  const myGeo = geoOf(me.name)
  const myPos = myGeo ? project(myGeo.lon, myGeo.lat) : { x: 30, y: H - 16 }

  const strip = others.filter((c) => !geoOf(c.name))
  const stripX = (i: number) =>
    strip.length === 1 ? W / 2 : 60 + (i * (W - 120)) / (strip.length - 1)

  const markers: Marker[] = [
    {
      id: me.id,
      name: me.name,
      life: me.average_life_level,
      relation: 'neutral', // color comes from the .us class, not the relation
      own: true,
      x: myPos.x,
      y: myPos.y,
    },
    ...others.map((c) => {
      const geo = geoOf(c.name)
      const pos = geo
        ? project(geo.lon, geo.lat)
        : { x: stripX(strip.findIndex((s) => s.id === c.id)), y: H - 16 }
      return {
        id: c.id,
        name: c.name,
        life: c.average_life_level,
        relation: relationOf(relations, c.id),
        own: false,
        x: pos.x,
        y: pos.y,
      }
    }),
  ]

  const ring = selectedId ? markers.find((m) => m.id === selectedId) : undefined

  return (
    <svg
      className="world-map"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Карта мира: мы — ${me.name}, плюс ${others.length} стран`}
    >
      {LAND.map((poly, i) => (
        <polygon
          key={`land-${i}`}
          className="land"
          points={poly
            .map(([lon, lat]) => {
              const p = project(lon, lat)
              return `${p.x},${p.y}`
            })
            .join(' ')}
        />
      ))}
      {SEAS.map((poly, i) => (
        <polygon
          key={`sea-${i}`}
          className="land"
          fill="var(--bg)"
          points={poly
            .map(([lon, lat]) => {
              const p = project(lon, lat)
              return `${p.x},${p.y}`
            })
            .join(' ')}
        />
      ))}

      {/* Diplomatic links: us to everyone, painted by the relation. */}
      {others.map((c) => {
        const marker = markers.find((m) => m.id === c.id)
        if (!marker) return null
        return (
          <line
            key={`link-${c.id}`}
            className={`link ${relationOf(relations, c.id)}`}
            x1={myPos.x}
            y1={myPos.y}
            x2={marker.x}
            y2={marker.y}
          />
        )
      })}

      {strip.length > 0 && (
        <line className="link neutral" x1={30} y1={H - 16} x2={W - 30} y2={H - 16} />
      )}

      {markers.map((m) => {
        const r = radius(m.life)
        return (
          <g
            key={m.id}
            role="button"
            aria-label={`${m.name} на карте${m.own ? ' (это мы)' : ` — ${RELATION_WORD[m.relation]}`}`}
            aria-pressed={selectedId === m.id}
            onClick={() => onSelect(m.id)}
          >
            {ring && ring.id === m.id && <circle className="halo" cx={m.x} cy={m.y} r={r + 3.5} />}
            <circle
              className={`marker ${m.own ? 'us' : m.relation}${selectedId === m.id ? ' sel' : ''}`}
              cx={m.x}
              cy={m.y}
              r={r}
            />
            <text
              x={m.x}
              y={m.y + r + 10}
              textAnchor="middle"
              fontSize={strip.some((s) => s.id === m.id) ? 8.5 : 9.5}
            >
              {m.name}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
