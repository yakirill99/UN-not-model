import type { Schemas } from '../api/client'
import { lifeLevel } from './format'
import { Medal } from './Medal'
import { allEqual } from './rank'

type Foreign = Schemas['ForeignCountryView']
type Me = Schemas['OwnCountryView']

/**
 * Foreign countries show only what the engine lets this player see:
 * which cities are alive, their life level, the laugh bonus. No budgets,
 * no arsenals, no shields — that is the fog of war of this game.
 *
 * The list is sorted by average life, best first, and the player's own country
 * counts in the ranking when `me` is given: the first question of the room is
 * «кто на первом месте», and nobody should compute places by hand (#2).
 * While the whole field is level (round one, all 0.00 %) no places are shown:
 * «все первые» — это не рейтинг, а отсутствие рейтинга.
 */
export default function Others({ others, me }: { others: Foreign[]; me?: Me | null }) {
  if (others.length === 0) return null

  // The ranking pool holds what the player can see: their own country plus the others.
  const pool: { id: string; average_life_level: number }[] = me ? [me, ...others] : others
  const unranked = allEqual(pool.map((c) => c.average_life_level))
  const placeOf = new Map(
    pool.map((c) => [
      c.id,
      pool.filter((x) => x.average_life_level > c.average_life_level).length + 1,
    ]),
  )
  const sorted = [...others].sort(
    (a, b) => b.average_life_level - a.average_life_level || a.name.localeCompare(b.name, 'ru'),
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
      {sorted.map((country) => {
        const alive = country.cities.filter((c) => !c.destroyed).length
        const place = placeOf.get(country.id) ?? 0
        return (
          <div key={country.id} className="other">
            <div className="row">
              <strong>
                <span className="muted">{unranked ? '— ' : `${place}. `}</span>
                {country.name}
                {!unranked && <Medal place={place} />}
              </strong>
              <span>{lifeLevel(country.average_life_level)}</span>
            </div>
            <p className="muted">
              Городов целы: {alive} из {country.cities.length}
              {country.laugh > 0 && ` · смех +${country.laugh}`}
            </p>
          </div>
        )
      })}
    </section>
  )
}
