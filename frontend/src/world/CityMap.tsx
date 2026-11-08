import type { Schemas } from '../api/client'
import { lifeLevel, percent } from '../country/format'
import { Icon } from '../ui/Icon'
import { squarify, type Rect } from './treemap'

type OwnCity = Schemas['OwnCityView']

const W = 640
const H = 400
const GAP = 5

/**
 * The territory of our state as one treemap, cut into city cells (#world).
 * A cell's area follows the city's life level — «чем большее значение несёт
 * город, тем больше фигура»; a destroyed city keeps a small red sliver.
 * The summary sits above the map, and clicking a cell (or a row in the list
 * below) highlights that city both ways.
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
  const container: Rect = { x: GAP, y: GAP, w: W - GAP * 2, h: H - GAP * 2 }
  const cells = squarify(
    container,
    cities.map((c) => (c.destroyed ? 0 : c.life_level)),
  )

  const alive = cities.filter((c) => !c.destroyed).length
  const destroyed = cities.length - alive
  const shields = cities.filter((c) => c.shield && !c.destroyed).length
  // The color reads against the strongest city of the round, not against 100 %:
  // early rounds would otherwise paint every cell the same pale green.
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

      <svg
        className="citymap"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Карта городов: целы ${alive} из ${cities.length}`}
      >
        {cells.map((cell, i) => {
          const city = cities[i]
          const area = cell.w * cell.h
          const ratio = city.destroyed ? 0 : city.life_level / maxLife
          const fill = city.destroyed
            ? 'var(--bad)'
            : `color-mix(in srgb, var(--ok) ${Math.round(Math.min(Math.max(ratio * 78 + 8, 8), 88))}%, var(--card))`
          const selected = selectedId === city.id
          const dimmed = selectedId != null && !selected
          const wide = cell.w > cell.h
          return (
            <g key={city.id}>
              <rect
                className={`cell${selected ? ' sel' : dimmed ? ' dim' : ''}`}
                x={cell.x}
                y={cell.y}
                width={cell.w}
                height={cell.h}
                rx={10}
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
              {area > 5200 && (
                <text
                  className="cell-name"
                  x={cell.x + cell.w / 2}
                  y={cell.y + cell.h / 2 + (area > 12000 ? -4 : 4)}
                  textAnchor="middle"
                >
                  {city.name}
                </text>
              )}
              {area > 12000 && (
                <text
                  className={wide ? 'cell-stat' : 'cell-stat vert'}
                  x={cell.x + cell.w / 2}
                  y={cell.y + cell.h / 2 + 13}
                  textAnchor="middle"
                  transform={
                    wide ? undefined : `rotate(-90 ${cell.x + cell.w / 2} ${cell.y + cell.h / 2})`
                  }
                >
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
