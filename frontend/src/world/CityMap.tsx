import type { Schemas } from '../api/client'
import { lifeLevel, percent } from '../country/format'
import { Icon } from '../ui/Icon'
import { hexLayout, hexPoints } from './hex'

type OwnCity = Schemas['OwnCityView']

const W = 640
const H = 400

/**
 * The territory of our state as a honeycomb (#world): one hexagon per city,
 * packed from the centre out. A hexagon's area follows the city's life level —
 * «чем большее значение несёт город, тем больше фигура»; a destroyed city
 * keeps a small red hexagon. Every label is horizontal: rotating text to
 * squeeze it into a cell was a bug, not a style («не переворачивай текст»).
 * The summary sits above the map, and clicking a hexagon (or a row in the
 * list below) highlights that city both ways.
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
  const hexes = hexLayout(
    cities.map((c) => (c.destroyed ? 0 : c.life_level)),
    { w: W, h: H },
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
        {hexes.map((hex, i) => {
          const city = cities[i]
          const ratio = city.destroyed ? 0 : city.life_level / maxLife
          const fill = city.destroyed
            ? 'var(--bad)'
            : `color-mix(in srgb, var(--ok) ${Math.round(Math.min(Math.max(ratio * 78 + 8, 8), 88))}%, var(--card))`
          const selected = selectedId === city.id
          const dimmed = selectedId != null && !selected
          // Labels only where the hexagon is big enough to carry them —
          // and always horizontal: no rotated text anywhere on the card.
          const fitsName = hex.r >= 26
          const fitsStat = hex.r >= 34
          return (
            <g key={city.id}>
              <polygon
                className={`cell${selected ? ' sel' : dimmed ? ' dim' : ''}`}
                points={hexPoints(hex)}
                style={{ fill }}
                fillOpacity={city.destroyed ? 0.35 : undefined}
                role="button"
                aria-label={
                  city.destroyed
                    ? `${city.name}: разрушен`
                    : `${city.name}: жизнь ${lifeLevel(city.life_level)}`
                }
                aria-pressed={selected}
                onClick={() => onSelect(selected ? null : city.id)}
              />
              {fitsName && !city.destroyed && (
                <text
                  className="cell-name"
                  x={hex.cx}
                  y={hex.cy + (fitsStat ? -3 : 4)}
                  textAnchor="middle"
                >
                  {city.name}
                </text>
              )}
              {fitsStat && !city.destroyed && (
                <text className="cell-stat" x={hex.cx} y={hex.cy + 13} textAnchor="middle">
                  {`${lifeLevel(city.life_level)} · разв. ${percent(city.development)}`}
                </text>
              )}
              {fitsName && city.destroyed && (
                <text className="cell-stat" x={hex.cx} y={hex.cy + 4} textAnchor="middle">
                  разрушен
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
