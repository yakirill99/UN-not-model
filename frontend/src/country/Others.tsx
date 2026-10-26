import type { Schemas } from '../api/client'
import { lifeLevel } from './format'
import { medalFor } from './rank'

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
 */
export default function Others({ others, me }: { others: Foreign[]; me?: Me | null }) {
  if (others.length === 0) return null

  // The ranking pool holds what the player can see: their own country plus the others.
  const pool: { id: string; average_life_level: number }[] = me ? [me, ...others] : others
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
      {sorted.map((country) => {
        const alive = country.cities.filter((c) => !c.destroyed).length
        const medal = medalFor(placeOf.get(country.id) ?? 0)
        return (
          <div key={country.id} className="other">
            <div className="row">
              <strong>
                <span className="muted">{placeOf.get(country.id)}. </span>
                {country.name}
                {medal && <span aria-hidden="true"> {medal}</span>}
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
