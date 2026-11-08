import { changes } from './changes'
import { describeEvent, type AnyEvent } from './news'
import { Icon } from '../ui/Icon'
import type { Names } from './names'

/**
 * The news ticker (#5): the round's events in one line that crawls along the
 * top of the play page — «сверху бегущую строку, как в новостях». The sticky
 * header carries it, so a page refresh answers «что изменилось?» before any
 * scrolling. The track holds the items twice: the animation shifts by exactly
 * one half, so the loop is seamless. Hover pauses the crawl; readers who
 * prefer no motion get a plain scrollable line instead.
 */
export default function Ticker({ news, names = {} }: { news: AnyEvent[]; names?: Names }) {
  const list = changes(news)
  if (list.length === 0) return null

  const half = list.map(({ event, icon, tone }, i) => (
    <span key={i} className={`ticker-item${tone ? ` ${tone}` : ''}`}>
      <Icon name={icon} size={15} />
      <span>{describeEvent(event, names)}</span>
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
