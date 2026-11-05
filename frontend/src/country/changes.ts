/**
 * The round's changes as pure data — the selection and ordering of the news,
 * with no React. The component in Changes.tsx only draws what this returns.
 */
import type { AnyEvent } from './news'

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

/**
 * Every event maps to a named icon file in /public/icons (swap the file, swap
 * the look). Most events share the icon of the action that caused them, so the
 * player learns one picture per decision, not one per consequence.
 */
const ICONS: Record<AnyEvent['type'], string> = {
  order_rejected: 'rejected',
  nuclear_strike: 'strike',
  city_destroyed: 'destroyed',
  sanction_applied: 'sanction',
  shield_built: 'shield',
  aid_transferred: 'aid',
  laugh_awarded: 'laugh',
  income_credited: 'income',
  tech_developed: 'nuclear_tech',
  bombs_produced: 'bomb',
  city_invested: 'invest',
  ecology_changed: 'eco_program',
  budget_spent: 'budget',
  // Bookkeeping: SKIP filters it out, the icon exists only for exhaustiveness.
  life_level_computed: 'flag',
  round_ended: 'flag',
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
