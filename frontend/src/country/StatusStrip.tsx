import type { ReactNode } from 'react'
import type { Schemas } from '../api/client'
import { ecologyTone, lifeLevel, money, percent } from './format'
import { Medal } from './Medal'
import { allEqual, rankOf } from './rank'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

/**
 * The sticky line of key numbers (#3): budget, life level, place, cities, ecology.
 *
 * Everything here is already printed on the card below — the strip only lifts it
 * to the top, so a page refresh answers «как мы вообще?» before any scrolling.
 * It is deliberately one line: on the projector and on a phone it must read
 * without wrapping, so each cell keeps its label tiny and its value whole.
 *
 * The place appears only once the field has separated: round one, everyone at
 * 0.00 %, would otherwise crown the whole room first at once.
 */
export default function StatusStrip({
  me,
  ecology,
  others,
  forecast,
  action,
}: {
  me: Me
  ecology: number
  others: Foreign[]
  /** What the current indicators will earn at the round's end (#11). */
  forecast?: number
  action?: ReactNode
}) {
  const { place, total } = rankOf(me, others)
  const unranked = allEqual([me.average_life_level, ...others.map((c) => c.average_life_level)])
  const alive = me.cities.filter((c) => !c.destroyed).length

  return (
    <div className="statusbar">
      <div className="stat">
        <span className="muted">Бюджет</span>
        <strong>{money(me.budget)}</strong>
      </div>
      {forecast != null && (
        <div className="stat">
          <span className="muted">Доход ≈</span>
          <strong title="Прогноз дохода на конец раунда по текущим показателям: чужие удары и санкции его изменят">
            {money(forecast)}
          </strong>
        </div>
      )}
      <div className="stat">
        <span className="muted">Средний УЖ</span>
        <strong title={unranked ? 'Жизнь посчитается при подведении итогов раунда' : undefined}>
          {lifeLevel(me.average_life_level)}
        </strong>
      </div>
      <div className="stat">
        <span className="muted">Место</span>
        <strong title={unranked ? 'Места ещё не разыграны' : undefined}>
          {unranked ? (
            '—'
          ) : (
            <>
              <Medal place={place} size={16} /> {place} из {total}
            </>
          )}
        </strong>
      </div>
      <div className="stat">
        <span className="muted">Городов целы</span>
        <strong>
          {alive} из {me.cities.length}
        </strong>
      </div>
      <div className="stat">
        <span className="muted">Экология</span>
        <strong className={ecologyTone(ecology)}>{percent(ecology)}</strong>
      </div>
      {action && <div className="statusbar-action">{action}</div>}
    </div>
  )
}
