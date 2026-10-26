import { describeEvent, type AnyEvent } from './news'

/** Pure bookkeeping: no number the player watches actually moves, so not a change. */
const SKIP = new Set<AnyEvent['type']>(['life_level_computed'])

/** Importance order: what hurts comes first, the wrap-up goes last. */
const ORDER: AnyEvent['type'][] = [
  'order_rejected',
  'nuclear_strike',
  'city_destroyed',
  'sanction_applied',
  'shield_built',
  'aid_transferred',
  'laugh_awarded',
  'income_credited',
  'tech_developed',
  'bombs_produced',
  'city_invested',
  'ecology_changed',
  'budget_spent',
  'round_ended',
]

/** Exhaustive on purpose: a new event type from the schema becomes a compile error here. */
const ICONS: Record<AnyEvent['type'], string> = {
  order_rejected: '❌',
  nuclear_strike: '💥',
  city_destroyed: '🏚',
  sanction_applied: '🚫',
  shield_built: '🛡',
  aid_transferred: '🤝',
  laugh_awarded: '😄',
  income_credited: '💰',
  tech_developed: '🔬',
  bombs_produced: '🧨',
  city_invested: '🏗',
  ecology_changed: '🌿',
  budget_spent: '💸',
  // Bookkeeping: SKIP filters it out, the icon exists only for exhaustiveness.
  life_level_computed: '·',
  round_ended: '🏁',
}

const BAD = new Set<AnyEvent['type']>([
  'order_rejected',
  'nuclear_strike',
  'city_destroyed',
  'sanction_applied',
])
const GOOD = new Set<AnyEvent['type']>([
  'shield_built',
  'aid_transferred',
  'laugh_awarded',
  'income_credited',
  'tech_developed',
])

export type Change = { event: AnyEvent; icon: string; tone: 'bad' | 'ok' | null }

function toneOf(type: AnyEvent['type']): Change['tone'] {
  if (BAD.has(type)) return 'bad'
  return GOOD.has(type) ? 'ok' : null
}

/**
 * The round's news, ordered by importance — pure, so the tests stay cheap.
 * Within one importance group the engine's own order is kept: it is already
 * causal, and re-sorting it would read like a shuffled deck.
 */
export function changes(news: AnyEvent[]): Change[] {
  return news
    .filter((event) => !SKIP.has(event.type))
    .map((event, index) => ({
      event,
      index,
      rank: ORDER.indexOf(event.type),
      icon: ICONS[event.type],
      tone: toneOf(event.type),
    }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ event, icon, tone }) => ({ event, icon, tone }))
}

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
              {icon}
            </span>
            <span>{describeEvent(event)}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
