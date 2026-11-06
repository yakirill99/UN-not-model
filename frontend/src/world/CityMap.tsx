import type { Schemas } from '../api/client'
import { lifeLevel, percent } from '../country/format'
import { Icon } from '../ui/Icon'
import { layoutTreemap, pathOf, polygonArea, polygonCentroid, type Poly } from './treemap'

type OwnCity = Schemas['OwnCityView']

const W = 320
const H = 216

/**
 * The territory of our state as one polygon, cut into city cells (#world).
 * A cell's area follows the city's life level — «чем большее значение несёт
 * город, тем больше фигура»; a destroyed city keeps a small red sliver.
 * The statistics sit along the edges of the polygon, and clicking a cell (or a
 * row in the list below) highlights that city both ways.
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
  // The outline is a hand-drawn irregular shape: a country, not a spreadsheet.
  const territory: Poly = [
    { x: 30, y: 30 },
    { x: 110, y: 20 },
    { x: 210, y: 24 },
    { x: 292, y: 48 },
    { x: 312, y: 110 },
    { x: 300, y: 178 },
    { x: 232, y: 204 },
    { x: 140, y: 208 },
    { x: 58, y: 196 },
    { x: 10, y: 138 },
    { x: 14, y: 68 },
  ]
  const cells = layoutTreemap(
    territory,
    cities.map((c) => (c.destroyed ? 0 : c.life_level)),
  )

  const alive = cities.filter((c) => !c.destroyed).length
  const destroyed = cities.length - alive
  const shields = cities.filter((c) => c.shield && !c.destroyed).length

  return (
    <>
      <svg
        className="citymap"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Карта городов: целы ${alive} из ${cities.length}`}
      >
        {/* Statistics along the edges of the polygon. */}
        <text className="edge-stat" x={8} y={11}>
          {`Городов целы: ${alive} из ${cities.length}`}
        </text>
        <text className="edge-stat" x={W - 8} y={11} textAnchor="end">
          {`Средняя жизнь: ${lifeLevel(average)}`}
        </text>
        <text className="edge-stat" x={8} y={H - 4}>
          {`Щитов: ${shields}`}
        </text>
        <text className="edge-stat" x={W - 8} y={H - 4} textAnchor="end">
          {`Разрушено: ${destroyed}`}
        </text>

        {cells.map((cell, i) => {
          const city = cities[i]
          const area = polygonArea(cell)
          const c = polygonCentroid(cell)
          const selected = selectedId === city.id
          const dimmed = selectedId != null && !selected
          const fill = city.destroyed
            ? 'var(--bad)'
            : `color-mix(in srgb, var(--ok) ${Math.min(Math.max(city.life_level / 100, 10), 92)}%, var(--card))`
          return (
            <g key={city.id}>
              <path
                className={`cell${selected ? ' sel' : dimmed ? ' dim' : ''}`}
                d={pathOf(cell)}
                style={{ fill }}
                fillOpacity={city.destroyed ? 0.3 : undefined}
                role="button"
                aria-label={
                  city.destroyed
                    ? `${city.name}: разрушен`
                    : `${city.name}: жизнь ${lifeLevel(city.life_level)}`
                }
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : city.id)}
              />
              {/* Labels only where the cell is big enough to carry them. */}
              {area > 340 && (
                <text
                  className="cell-name"
                  x={c.x}
                  y={c.y + (area > 800 ? -2 : 3)}
                  textAnchor="middle"
                >
                  {city.name}
                </text>
              )}
              {area > 800 && (
                <text className="cell-stat" x={c.x} y={c.y + 9} textAnchor="middle">
                  {city.destroyed
                    ? 'разрушен'
                    : `${lifeLevel(city.life_level)} · разв. ${percent(city.development)}`}
                </text>
              )}
            </g>
          )
        })}
      </svg>

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
                  {city.destroyed && <span className="bad"> · разрушен</span>}
                </span>
                <span className="muted">
                  {city.destroyed
                    ? '—'
                    : `Жизнь ${lifeLevel(city.life_level)} · Развитие ${percent(city.development)}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
