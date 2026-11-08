import { describeEvent, type AnyEvent } from './news'
import type { Names } from './names'

/** Round events as a plain list; the wording lives in news.ts. */
export default function News({ news, names = {} }: { news: AnyEvent[]; names?: Names }) {
  if (news.length === 0) {
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
        {news.map((event, i) => (
          <li key={i}>{describeEvent(event, names)}</li>
        ))}
      </ul>
    </section>
  )
}
