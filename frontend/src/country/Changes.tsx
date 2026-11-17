import { changes } from './changes'
import { describeGroup, type AnyEvent } from './news'
import { Icon } from '../ui/Icon'
import type { Names } from './names'

/**
 * The glanceable top card (#6): what this round changed, worst first, so the
 * player sees the strike on their city without scrolling to the bottom log.
 * The full «Новости раунда» below keeps every story, this one keeps only news.
 * Same-kind events arrive pre-merged: three investments are one line.
 */
export default function Changes({ news, names = {} }: { news: AnyEvent[]; names?: Names }) {
  const list = changes(news)
  if (list.length === 0) return null

  return (
    <section className="card stack">
      <h2>Что изменилось за раунд</h2>
      <ul className="feed changes">
        {list.map(({ group, icon, tone }) => (
          <li key={group.key} className={tone ?? undefined}>
            <span className="feed-icon" aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
            <span>{describeGroup(group, names)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
