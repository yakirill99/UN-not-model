import { changes } from './changes'
import { describeEvent, type AnyEvent } from './news'
import { Icon } from '../ui/Icon'

/**
 * The glanceable top card (#6): what this round changed, worst first, so the
 * player sees the strike on their city without scrolling to the bottom log.
 * The full «Новости раунда» below keeps every line, this one keeps only news.
 */
export default function Changes({ news }: { news: AnyEvent[] }) {
  const list = changes(news)
  if (list.length === 0) return null

  return (
    <section className="card stack">
      <h2>Что изменилось за раунд</h2>
      <ul className="feed changes">
        {list.map(({ event, icon, tone }, i) => (
          <li key={i} className={tone ?? undefined}>
            <span className="feed-icon" aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
            <span>{describeEvent(event)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
