import { describeGroup, type AnyEvent } from './news'
import { mergeNews } from './merge'
import type { Names } from './names'

/**
 * Round events as a plain list — the wording lives in news.ts. Same-kind
 * events are merged into one line: «бот 3 раза инвестирует» is one story.
 */
export default function News({ news, names = {} }: { news: AnyEvent[]; names?: Names }) {
  const stories = mergeNews(news)
  if (stories.length === 0) {
    return (
      <section className="card">
        <h2>Новости раунда</h2>
        <p className="muted">Пока ничего не произошло.</p>
      </section>
    )
  }

  return (
    <section className="card stack">
      <h2>Новости раунда</h2>
      <ul className="news">
        {stories.map((group) => (
          <li key={group.key}>{describeGroup(group, names)}</li>
        ))}
      </ul>
    </section>
  )
}
