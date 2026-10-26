import type { ReactNode } from 'react'
import type { Schemas } from '../api/client'
import { ecologyTone, lifeLevel, money, percent } from './format'
import { medalFor, rankOf } from './rank'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

/**
 * The sticky line of key numbers (#3): budget, life level, place, cities, ecology.
 *
 * Everything here is already printed on the card below — the strip only lifts it
 * to the top, so a page refresh answers «как мы вообще?» before any scrolling.
 * It is deliberately one line: on the projector and on a phone it must read
 * without wrapping, so each cell keeps its label tiny and its value whole.
 */
export default function StatusStrip({
  me,
  ecology,
  others,
  action,
}: {
  me: Me
  ecology: number
  others: Foreign[]
  action?: ReactNode
}) {
  const { place, total } = rankOf(me, others)
  const alive = me.cities.filter((c) => !c.destroyed).length
  const medal = medalFor(place)

  return (
    <div className="statusbar">
      <div className="stat">
        <span className="muted">Бюджет</span>
        <strong>{money(me.budget)}</strong>
      </div>
      <div className="stat">
        <span className="muted">Средний УЖ</span>
        <strong>{lifeLevel(me.average_life_level)}</strong>
      </div>
      <div className="stat">
        <span className="muted">Место</span>
        <strong>
          {medal && `${medal} `}
          {place} из {total}
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
