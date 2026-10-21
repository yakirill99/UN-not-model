import type { Schemas } from '../api/client'
import { lifeLevel, percent } from './format'

type OwnCity = Schemas['OwnCityView']

/**
 * Own cities: development, shield and life level are all visible.
 * A destroyed city keeps its row — players need to see what they lost.
 */
export default function CityList({ cities }: { cities: OwnCity[] }) {
  if (cities.length === 0) return <p className="muted">Городов нет.</p>

  return (
    <table className="cities">
      <thead>
        <tr>
          <th>Город</th>
          <th>Развитие</th>
          <th>Жизнь</th>
          <th>Щит</th>
        </tr>
      </thead>
      <tbody>
        {cities.map((city) => (
          <tr key={city.id} className={city.destroyed ? 'destroyed' : undefined}>
            <td>
              {city.name}
              {city.destroyed && <span className="bad"> · разрушен</span>}
            </td>
            <td>{city.destroyed ? '—' : percent(city.development)}</td>
            <td>{city.destroyed ? '—' : lifeLevel(city.life_level)}</td>
            <td>{city.shield ? <span title="Противоракетный щит">🛡</span> : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
