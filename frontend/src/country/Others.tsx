import type { Schemas } from '../api/client'
import { lifeLevel } from './format'
import { Icon } from '../ui/Icon'
import { Medal } from './Medal'
import { allEqual } from './rank'

type Foreign = Schemas['ForeignCountryView']
type Me = Schemas['OwnCountryView']

type Row = { id: string; name: string; life: number; me: boolean }

/**
 * Foreign countries show only what the engine lets this player see:
 * which cities are alive, their life level, the laugh bonus. No budgets,
 * no arsenals, no shields — that is the fog of war of this game.
 *
 * The playtest asked for the ranking as a bar chart — «сразу было понятно,
 * кто на первом месте» (#2, #8) — and for the city break-down of other
 * countries (#7): both are here. Our own country sits in the same chart as
 * «Вы», so the room reads the gap to the leader without counting. While the
 * whole field is level (round one, all 0.00 %) no places are shown:
 * «все первые» — это не рейтинг, а отсутствие рейтинга.
 */
export default function Others({ others, me }: { others: Foreign[]; me?: Me | null }) {
  if (others.length === 0) return null

  // The ranking pool holds what the player can see: their own country plus the others.
  const pool: Row[] = [
    ...(me ? [{ id: me.id, name: me.name, life: me.average_life_level, me: true }] : []),
    ...others.map((c) => ({ id: c.id, name: c.name, life: c.average_life_level, me: false })),
  ]
  const unranked = allEqual(pool.map((c) => c.life))
  const placeOf = new Map(pool.map((c) => [c.id, pool.filter((x) => x.life > c.life).length + 1]))
  const sorted = [...others].sort(
    (a, b) => b.average_life_level - a.average_life_level || a.name.localeCompare(b.name, 'ru'),
  )
  const meRow = pool.find((c) => c.me)
  // One scale for every bar: the leader fills the track, the rest trail behind.
  const maxLife = Math.max(...pool.map((c) => c.life), 1)
  const bar = (row: Row, place: number) => (
    <div className={row.me ? 'bar-row me' : 'bar-row'} key={row.id}>
      <span className="bar-name">
        {unranked ? '— ' : `${place}. `}
        {row.me ? 'Вы' : row.name}
        {!unranked && <Medal place={place} />}
      </span>
      <span className="bar-track">
        <span
          className="bar-fill"
          style={{ width: `${Math.min(100, (row.life / maxLife) * 100)}%` }}
        />
      </span>
      <span className="bar-value">{lifeLevel(row.life)}</span>
    </div>
  )

  return (
    <section className="card stack">
      <h2>Другие страны</h2>
      {/* Round one reads «0.00 %» everywhere and looks broken — it is not:
          the engine computes life at the round's end. Say so once, here. */}
      {unranked && (
        <p className="muted">
          Уровень жизни пока у всех одинаковый — движок посчитает его при подведении итогов раунда,
          тогда и разыграются места.
        </p>
      )}

      {/* The chart first: «кто первый» должен читаться без подсчётов (#2). */}
      <div className="rankbars" role="img" aria-label="Рейтинг стран по среднему уровню жизни">
        {meRow ? bar(meRow, placeOf.get(meRow.id) ?? 1) : null}
        {sorted.map((country) =>
          bar(
            { id: country.id, name: country.name, life: country.average_life_level, me: false },
            placeOf.get(country.id) ?? 1,
          ),
        )}
      </div>

      {sorted.map((country) => {
        const alive = country.cities.filter((c) => !c.destroyed).length
        return (
          <div key={country.id} className="other">
            <div className="row">
              <strong>{country.name}</strong>
              <span className="muted">
                Городов целы: {alive} из {country.cities.length}
                {country.laugh > 0 && ` · смех +${country.laugh}`}
              </span>
            </div>
            {/* Cities of foreign countries (#7): life level per city, ruins marked. */}
            <ul className="chips city-chips">
              {country.cities.map((city) => (
                <li
                  key={city.id}
                  className={city.destroyed ? 'chip gone' : 'chip'}
                  title={
                    city.destroyed
                      ? 'Город разрушен'
                      : `Уровень жизни: ${lifeLevel(city.life_level)}`
                  }
                >
                  {city.destroyed && <Icon name="destroyed" size={12} />} {city.name}
                  {city.destroyed ? ' — разрушен' : ` · ${lifeLevel(city.life_level)}`}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </section>
  )
}
