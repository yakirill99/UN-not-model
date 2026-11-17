import { changes } from './changes'
import { describeGroup, type AnyEvent } from './news'
import { Icon } from '../ui/Icon'
import type { Names } from './names'

/**
 * The news ticker (#5): the round's events in one line that crawls along the
 * top of the play page — «сверху бегущую строку, как в новостях». The sticky
 * header carries it, so a page refresh answers «что изменилось?» before any
 * scrolling. The track holds the items twice: the animation shifts by exactly
 * one half, so the loop is seamless. Hover pauses the crawl; readers who
 * prefer no motion get a plain scrollable line instead. Same-kind events are
 * merged (merge.ts), so one story never crawls past three times.
 */
export default function Ticker({ news, names = {} }: { news: AnyEvent[]; names?: Names }) {
  const list = changes(news)
  if (list.length === 0) return null

  const half = list.map(({ group, icon, tone }) => (
    <span key={group.key} className={`ticker-item${tone ? ` ${tone}` : ''}`}>
      <Icon name={icon} size={15} />
      <span>{describeGroup(group, names)}</span>
    </span>
  ))

  return (
    <div className="ticker" role="status" aria-label="События раунда бегущей строкой">
      <div className="ticker-track">
        <span className="ticker-half">{half}</span>
        <span className="ticker-half" aria-hidden="true">
          {half}
        </span>
      </div>
    </div>
  )
}
