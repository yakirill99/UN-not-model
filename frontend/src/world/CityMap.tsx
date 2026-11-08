import type { Schemas } from '../api/client'
import { lifeLevel, percent } from '../country/format'
import { Icon } from '../ui/Icon'
import { hexClusters, hexPoints } from './hex'

type OwnCity = Schemas['OwnCityView']

const W = 640
const H = 400

/**
 * The territory of our state as a true honeycomb (#world): identical cells
 * packed edge to edge, a city owning one contiguous blob. The blob's size
 * follows the city's weight — life level × development — «размер складывался
 * из объёма уровня жизни и развития»; a destroyed city keeps a single red
 * cell. Labels are HTML, not SVG text: they never scale with the map, so the
 * font stays crisp on any monitor — «шрифт плохой, все слова размыты» was the
 * verdict on the scaled-SVG labels. Labels stay horizontal — rotating text to
 * squeeze it into a cell was a bug, not a style. Clicking a cell (or a row in
 * the list below) highlights the city both ways.
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

      <div className="citymap-wrap">
        <svg
          className="citymap"
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Карта городов: целы ${alive} из ${cities.length}`}
        >
          {clusters.map((cluster, i) => {
            const city = cities[i]
            const ratio = city.destroyed ? 0 : city.life_level / maxLife
            const fill = city.destroyed
              ? 'var(--bad)'
              : `color-mix(in srgb, var(--ok) ${Math.round(Math.min(Math.max(ratio * 78 + 8, 8), 88))}%, var(--card))`
            const selected = selectedId === city.id
            const dimmed = selectedId != null && !selected
            return cluster.cells.map((cell, j) => (
              <polygon
                key={`${city.id}-${j}`}
                className={`cell${selected ? ' sel' : dimmed ? ' dim' : ''}`}
                points={hexPoints(cell)}
                style={{ fill }}
                fillOpacity={city.destroyed ? 0.35 : undefined}
                // One semantic button per city — the first cell of its blob;
                // the rest stay clickable to the mouse but silent to a screen
                // reader, so a 20-cell city does not read twenty times over.
                role={j === 0 ? 'button' : 'presentation'}
                aria-label={
                  city.destroyed
                    ? `${city.name}: разрушен`
                    : `${city.name}: жизнь ${lifeLevel(city.life_level)}`
                }
                aria-pressed={j === 0 ? selected : undefined}
                onClick={() => onSelect(selected ? null : city.id)}
              />
            ))
          })}
          {/* Territory borders: every face a cell turns to another city or the
              void — what makes the honeycomb read as a map of cities. */}
          <g className="borders" aria-hidden="true">
            {clusters.flatMap((cluster, i) =>
              cluster.cells.flatMap((cell, j) =>
                cell.edges.map((e, k) => (
                  <line key={`${i}-${j}-${k}`} x1={e[0]} y1={e[1]} x2={e[2]} y2={e[3]} />
                )),
              ),
            )}
          </g>
        </svg>

        {/* HTML labels: fixed-size type, always crisp, never mirrored. Close
            centroids (a city hugging another) are nudged apart vertically. */}
        {(() => {
          const pos = clusters.map((c) => ({ x: c.cx, y: c.cy }))
          for (let a = 0; a < pos.length; a++) {
            for (let b = a + 1; b < pos.length; b++) {
              if (Math.abs(pos[a].x - pos[b].x) < 150 && Math.abs(pos[a].y - pos[b].y) < 40) {
                if (pos[a].y <= pos[b].y) pos[b].y = pos[a].y + 42
                else pos[a].y = pos[b].y + 42
              }
            }
          }
          return clusters.map((cluster, i) => {
            const city = cities[i]
            const r = cluster.cells[0]?.r ?? 0
            const fitsName = r >= 9
            const fitsStat = r >= 13
            if (!fitsName) return null
            return (
              <div
                key={city.id}
                className="citymap-label"
                style={{ left: `${(pos[i].x / W) * 100}%`, top: `${(pos[i].y / H) * 100}%` }}
              >
                {city.destroyed ? (
                  <span className="stat bad">разрушен</span>
                ) : (
                  <>
                    <span className="name">{city.name}</span>
                    {fitsStat && (
                      <span className="stat">
                        {`${lifeLevel(city.life_level)} · разв. ${percent(city.development)}`}
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })
        })()}
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
