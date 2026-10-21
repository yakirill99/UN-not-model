import type { Schemas } from '../api/client'
import { lifeLevel } from './format'

type Foreign = Schemas['ForeignCountryView']

/**
 * Foreign countries show only what the engine lets this player see:
 * which cities are alive, their life level, the laugh bonus. No budgets,
 * no arsenals, no shields — that is the fog of war of this game.
 */
export default function Others({ others }: { others: Foreign[] }) {
  if (others.length === 0) return null

  return (
    <section className="card stack">
      <h2>Другие страны</h2>
      {others.map((country) => {
        const alive = country.cities.filter((c) => !c.destroyed).length
        return (
          <div key={country.id} className="other">
            <div className="row">
              <strong>{country.name}</strong>
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
