import { useState } from 'react'
import type { Observation, Schemas } from '../api/client'
import { lifeLevel, money } from '../country/format'
import { allEqual } from '../country/rank'
import { Flag } from './Flag'
import CityMap from './CityMap'
import WorldMap from './WorldMap'
import { relationOf, useDiplomacy, RELATIONS, type Relation } from './diplomacy'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

const RELATION_LABEL: Record<Relation, string> = {
  friend: 'Друг',
  neutral: 'Нейтрал',
  enemy: 'Враг',
}

/**
 * The experimental «Мир» tab (#world): a stylized world map with manual
 * diplomacy, and the cities of our state as one polygon cut by value.
 * Nothing here feeds back into the engine yet — it is an overlay for seeing
 * the room, not a new rule.
 */
export default function WorldTab({ obs, gameId }: { obs: Observation; gameId?: string }) {
  const { relations, setRelation } = useDiplomacy(gameId)
  const [countryId, setCountryId] = useState<string | null>(null)
  const [cityId, setCityId] = useState<string | null>(null)

  const foreign = countryId ? obs.others.find((c) => c.id === countryId) : undefined
  const meSelected = countryId === obs.me.id

  return (
    <div className="stack">
      <p className="muted">
        Экспериментальная вкладка. Карта схематичная: выберите страну — подсветится её статистика;
        отметьте «Друг» или «Враг» — связь окрасится. Отметки хранятся только у вас.
      </p>

      <section className="card stack">
        <div className="row">
          <h2>Карта мира</h2>
          <ul className="legend-chips">
            <li>
              <span className="swatch" style={{ background: 'var(--diplo-us)' }} /> Мы
            </li>
            <li>
              <span className="swatch" style={{ background: 'var(--diplo-friend)' }} /> Друг
            </li>
            <li>
              <span className="swatch" style={{ background: 'var(--diplo-neutral)' }} /> Нейтрал
            </li>
            <li>
              <span className="swatch" style={{ background: 'var(--diplo-enemy)' }} /> Враг
            </li>
          </ul>
        </div>

        <WorldMap
          me={obs.me}
          others={obs.others}
          relations={relations}
          selectedId={countryId}
          onSelect={(id) => setCountryId(id === countryId ? null : id)}
        />

        {foreign && (
          <ForeignCard
            country={foreign}
            me={obs.me}
            others={obs.others}
            relation={relationOf(relations, foreign.id)}
            onSet={(r) => setRelation(foreign.id, r)}
          />
        )}
        {meSelected && <MeCard me={obs.me} />}
      </section>

      <section className="card stack">
        <h2>Мои города на карте</h2>
        <CityMap
          cities={obs.me.cities}
          average={obs.me.average_life_level}
          selectedId={cityId}
          onSelect={setCityId}
        />
      </section>
    </div>
  )
}

/** A foreign country: only what the fog of war allows, plus the manual marks. */
function ForeignCard({
  country,
  me,
  others,
  relation,
  onSet,
}: {
  country: Foreign
  me: Me
  others: Foreign[]
  relation: Relation
  onSet: (r: Relation) => void
}) {
  const pool = [me, ...others]
  const unranked = allEqual(pool.map((c) => c.average_life_level))
  const place = pool.filter((c) => c.average_life_level > country.average_life_level).length + 1
  const alive = country.cities.filter((c) => !c.destroyed).length

  return (
    <div className="other stack">
      <div className="row">
        <strong>
          <Flag name={country.name} /> {country.name}
        </strong>
        <span>{unranked ? 'место не разыграно' : `${place} место`}</span>
      </div>
      <p className="muted">
        Средняя жизнь: {lifeLevel(country.average_life_level)} · Городов целы: {alive} из{' '}
        {country.cities.length}
        {country.laugh > 0 && ` · смех +${country.laugh}`}
      </p>
      <div className="relation" role="group" aria-label={`Отношение к стране ${country.name}`}>
        {RELATIONS.map((r) => (
          <button
            key={r}
            type="button"
            className={r}
            aria-pressed={relation === r}
            onClick={() => onSet(r)}
          >
            {RELATION_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Our own country: always blue on the map, no relation buttons for it. */
function MeCard({ me }: { me: Me }) {
  const alive = me.cities.filter((c) => !c.destroyed).length
  return (
    <div className="other stack">
      <div className="row">
        <strong>
          <Flag name={me.name} /> {me.name}
        </strong>
        <span className="muted">это мы</span>
      </div>
      <p className="muted">
        Бюджет: {money(me.budget)} · Средняя жизнь: {lifeLevel(me.average_life_level)} · Городов
        целы: {alive} из {me.cities.length} · Бомбы: {me.bombs}
      </p>
    </div>
  )
}
