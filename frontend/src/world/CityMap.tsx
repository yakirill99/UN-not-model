import type { Schemas } from '../api/client'
import { lifeLevel, percent } from '../country/format'
import { Icon } from '../ui/Icon'
import { hexClusters, hexPoints } from './hex'

type OwnCity = Schemas['OwnCityView']

const W = 640
const H = 400

/**
 * The territory of our state on the map (#world): ONE hexagon per city, the
 * hexagons packed side by side — «сделай их рядом друг с другом», after three
 * rounds of scattered/overlaid layouts this is the shape that finally reads.
 * The hexagon's radius follows the city's weight — life level × development —
 * «размер складывался из объёма уровня жизни и развития»; a destroyed city
 * keeps one small red hexagon. Labels are HTML, not SVG text: they never scale
 * with the map, so the font stays crisp on any monitor — and each label sits
 * in the MIDDLE of its own hexagon («надписи не там» was the verdict on the
 * wedge layout). Clicking a hexagon (or a row in the list below) highlights
 * the city both ways.
 */
export default function CityMap({
  cities,
  average,
  selectedId,
  onSelect,
}: {
  cities: OwnCity[]
  average: number
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  // The weight carries BOTH numbers the city lives on: its life level (in
  // 1/100 %) and its development (whole %). A destroyed city weighs nothing.
  const clusters = hexClusters(
    cities.map((c) => (c.destroyed ? 0 : (c.life_level / 100) * Math.max(c.development, 1))),
    { w: W, h: H },
  )

  const alive = cities.filter((c) => !c.destroyed).length
  const destroyed = cities.length - alive
  const shields = cities.filter((c) => c.shield && !c.destroyed).length
  // The color reads against the strongest city of the round, not against 100 %:
  // early rounds would otherwise paint every hexagon the same pale green.
  const maxLife = Math.max(...cities.map((c) => c.life_level), 1)

  return (
    <>
      <ul className="citymap-facts" aria-label="Сводка по городам">
        <li>
          <span className="muted">Городов целы</span>
          <strong>
            {alive} из {cities.length}
          </strong>
        </li>
        <li>
          <span className="muted">Средняя жизнь</span>
          <strong>{lifeLevel(average)}</strong>
        </li>
        <li>
          <span className="muted">Щитов</span>
          <strong>{shields}</strong>
        </li>
        <li>
          <span className="muted">Разрушено</span>
          <strong className={destroyed > 0 ? 'bad' : undefined}>{destroyed}</strong>
        </li>
      </ul>

      <div className="citymap-wrap">
        <svg
          className="citymap"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Карта городов: целы ${alive} из ${cities.length}`}
        >
          {clusters.map((cluster, i) => {
            const city = cities[i]
            const hex = cluster.cells[0]
            const ratio = city.destroyed ? 0 : city.life_level / maxLife
            const fill = city.destroyed
              ? 'var(--bad)'
              : `color-mix(in srgb, var(--ok) ${Math.round(Math.min(Math.max(ratio * 78 + 8, 8), 88))}%, var(--card))`
            const selected = selectedId === city.id
            const dimmed = selectedId != null && !selected
            return (
              <polygon
                key={city.id}
                className={`cell${selected ? ' sel' : dimmed ? ' dim' : ''}`}
                points={hexPoints(hex)}
                style={{ fill }}
                fillOpacity={city.destroyed ? 0.35 : undefined}
                role="button"
                aria-label={
                  city.destroyed
                    ? `${city.name}, разрушен`
                    : `${city.name}, жизнь ${lifeLevel(city.life_level)}`
                }
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : city.id)}
              />
            )
          })}
        </svg>

        {/* HTML labels: fixed-size type, always crisp. One label per city, dead
            centre of its hexagon — the packing guarantees the room to fit. */}
        {clusters.map((cluster, i) => {
          const city = cities[i]
          const hex = cluster.cells[0]
          const fitsName = hex.r >= 26
          const fitsStat = hex.r >= 34
          if (!fitsName) return null
          return (
            <div
              key={city.id}
              className="citymap-label"
              style={{ left: `${(hex.cx / W) * 100}%`, top: `${(hex.cy / H) * 100}%` }}
            >
              {city.destroyed ? (
                <span className="stat bad">разрушен</span>
              ) : (
                <>
                  <span className="name">{city.name}</span>
                  {fitsStat && (
                    <span className="stat">
                      {`жизнь ${lifeLevel(city.life_level)}, развитие ${percent(city.development)}`}
                    </span>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      <ul className="city-stats">
        {cities.map((city) => {
          const selected = selectedId === city.id
          return (
            <li key={city.id} className={selected ? 'on' : undefined}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : city.id)}
              >
                <span>
                  {city.name}
                  {city.shield && !city.destroyed && (
                    <>
                      {' '}
                      <span title="Ядерный щит">
                        <Icon name="shield" size={14} />
                      </span>
                    </>
                  )}
                  {city.destroyed && <span className="bad">, разрушен</span>}
                </span>
                <span className="muted">
                  {city.destroyed
                    ? '—'
                    : `Жизнь ${lifeLevel(city.life_level)}, развитие ${percent(city.development)}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
