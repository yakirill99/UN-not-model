import type { Schemas } from '../api/client'
import CityList from './CityList'
import { lifeLevel, money } from './format'

type Me = Schemas['OwnCountryView']

/**
 * The player's own country: everything is visible here, including the numbers
 * that stay secret from other teams (budget, bombs, arriving aid, sanctions).
 */
export default function MyCountry({ me }: { me: Me }) {
  return (
    <section className="card stack">
      <div className="row">
        <span className="muted">Бюджет</span>
        <strong>{money(me.budget)}</strong>
      </div>
      <div className="row">
        <span className="muted">Средний уровень жизни</span>
        <strong>{lifeLevel(me.average_life_level)}</strong>
      </div>
      {me.laugh > 0 && (
        <div className="row">
          <span className="muted">Коэффициент смеха</span>
          <strong>+{me.laugh}</strong>
        </div>
      )}

      <CityList cities={me.cities} />

      <ul className="facts">
        <li>
          Ядерная технология:{' '}
          {me.nuclear_tech ? <span className="ok">есть</span> : <span className="muted">нет</span>}
        </li>
        <li>{bombsLine(me)}</li>
        {me.aid_pending > 0 && (
          <li className="muted">{`Помощь ${money(me.aid_pending)} зачислится в начале следующего раунда`}</li>
        )}
        {me.sanctioned_by.length > 0 && (
          <li className="bad">{`Санкции против нас: ${me.sanctioned_by.join(', ')}`}</li>
        )}
      </ul>
    </section>
  )
}

/** Ready bombs and the ones still in production are different resources — never sum them. */
function bombsLine(me: Me): string {
  const ready = `Бомбы: ${me.bombs} готовы`
  return me.bombs_pending > 0
    ? `${ready}, ещё ${me.bombs_pending} будут готовы в следующем раунде`
    : ready
}
