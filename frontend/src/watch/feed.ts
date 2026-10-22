/**
 * The round's events as the room should hear them: what happened to a country,
 * never who did it.
 *
 * The host's /events is unredacted — it names the striker — but this feed goes on a
 * projector, and naming the author would end the game's central guessing. So the
 * actor is dropped here for everything the players could not have seen themselves.
 * `describeEvent` in country/news.ts does the same job for one player's own news.
 */
import type { AnyEvent } from './core'
import { money, percent } from '../country/format'

/** A line on the screen: an icon, a sentence, and the category it can be filtered by. */
export type Entry = {
  key: string
  round: number
  kind: Kind
  icon: string
  text: string
}

export type Kind = 'build' | 'eco' | 'war' | 'deal'

export const KINDS: { id: Kind; label: string }[] = [
  { id: 'build', label: 'Развитие' },
  { id: 'eco', label: 'Экология' },
  { id: 'war', label: 'Оружие' },
  { id: 'deal', label: 'Дипломатия' },
]

/**
 * Events nobody needs on a screen: per-country bookkeeping, not news.
 * `round_ended` is one per country per round and would bury the real events.
 */
const SILENT = new Set([
  'budget_spent',
  'income_credited',
  'life_level_computed',
  'order_rejected',
  'round_ended',
])

/**
 * Build the public feed, newest round first.
 *
 * `names` maps ids to the words the room reads; an unknown id falls back to itself
 * rather than disappearing, so a scenario change can never blank the screen.
 */
export function feed(events: AnyEvent[], names: Record<string, string>): Entry[] {
  const out: Entry[] = []
  for (const [i, e] of events.entries()) {
    if (SILENT.has(e.type)) continue
    const line = describe(e, (id: string | null | undefined) => (id ? (names[id] ?? id) : '—'))
    if (line) out.push({ key: `${e.round}-${i}`, round: e.round, ...line })
  }
  return out.reverse()
}

export function filterKinds(entries: Entry[], kinds: Set<Kind>): Entry[] {
  return kinds.size === 0 ? entries : entries.filter((e) => kinds.has(e.kind))
}

type Line = { kind: Kind; icon: string; text: string } | null
type Name = (id: string | null | undefined) => string

function describe(e: AnyEvent, name: Name): Line {
  switch (e.type) {
    case 'city_invested':
      return {
        kind: 'build',
        icon: '🏙',
        text: `${name(e.target)}: развитие ${percent(e.development_before)} → ${percent(e.development_after)}`,
      }
    case 'ecology_changed':
      return {
        kind: 'eco',
        icon: e.delta > 0 ? '♻️' : '☁️',
        // The cause is a rule id ("bomb_production"), never a country: safe to show.
        text: `Экология ${e.delta > 0 ? '+' : ''}${e.delta} → ${percent(e.ecology_after)}`,
      }
    case 'tech_developed':
      return { kind: 'war', icon: '☢️', text: `${name(e.actor)} освоила ядерную технологию` }
    case 'bombs_produced':
      return { kind: 'war', icon: '💣', text: `${name(e.actor)} произвела бомб: ${e.count}` }
    case 'shield_built':
      return { kind: 'war', icon: '🛡', text: `${name(e.target)} под ядерным щитом` }
    case 'nuclear_strike':
      // The author stays hidden: this is the heart of the game's secrecy.
      return {
        kind: 'war',
        icon: '🚀',
        text: `Ядерный удар по ${name(e.target)}: ${STRIKE[e.outcome]}`,
      }
    case 'city_destroyed':
      return { kind: 'war', icon: '💥', text: `Город ${name(e.target)} разрушен` }
    case 'sanction_applied':
      // Sanctions are public by the rules — the victim is told who imposed them.
      return {
        kind: 'deal',
        icon: '❌',
        text: `${name(e.actor)} ввела санкции против ${name(e.target)}: развитие −${e.delta}`,
      }
    case 'aid_transferred':
      return {
        kind: 'deal',
        icon: '💸',
        text: `${name(e.actor)} передала ${money(e.amount)} стране ${name(e.target)}`,
      }
    case 'laugh_awarded':
      return { kind: 'deal', icon: '😄', text: `Приз за юмор: ${name(e.target)}` }
    default:
      return null
  }
}

const STRIKE: Record<string, string> = {
  absorbed: 'щит поглотил удар',
  destroyed: 'город разрушен',
  already_destroyed: 'город уже был разрушен',
}
