/**
 * The round's events as the room should hear them: what happened to a country,
 * never who did it.
 *
 * The host's /events is unredacted — it names the striker — but this feed goes on a
 * projector, and naming the author would end the game's central guessing. So the
 * actor is dropped here for everything the players could not have seen themselves.
 * `describeEvent` in country/news.ts does the same job for one player's own news.
 */
import { mergeNews, plural, times, type Group } from '../country/merge'
import type { AnyEvent } from './core'
import { money, percent } from '../country/format'

/**
 * A line on the screen: an icon, a sentence, and the category it can be filtered by.
 * The icon is the name of a file in /public/icons — swap the file, swap the look.
 */
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
 *
 * Same-kind events merge into one line (merge.ts): a country investing three
 * times is one line about growth — «должна быть объединённая одна новость».
 */
export function feed(events: AnyEvent[], names: Record<string, string>): Entry[] {
  const out: Entry[] = []
  const name: Name = (id) => (id ? (names[id] ?? id) : '—')
  for (const group of mergeNews(events.filter((e) => !SILENT.has(e.type)))) {
    const line = describe(group, name)
    if (line) out.push({ key: group.key, round: group.events[0].round, ...line })
  }
  return out.reverse()
}

/**
 * The kind filter is a switch, not a stack: one selected kind is shown, «Все»
 * shows everything — «чтобы это был режим переключения между фильтрами, а не
 * наложение». `null` means all.
 */
export function filterKinds(entries: Entry[], kind: Kind | null): Entry[] {
  return kind == null ? entries : entries.filter((e) => e.kind === kind)
}

type Line = { kind: Kind; icon: string; text: string } | null
type Name = (id: string | null | undefined) => string

function describe(group: Group, name: Name): Line {
  const e = group.events[0]
  const n = group.events.length
  switch (e.type) {
    case 'city_invested': {
      const runs = new Map<string, { before: number; after: number }>()
      for (const x of group.events as Extract<AnyEvent, { type: 'city_invested' }>[]) {
        const run = runs.get(x.target ?? '')
        if (run) run.after = x.development_after
        else runs.set(x.target ?? '', { before: x.development_before, after: x.development_after })
      }
      const list = [...runs.entries()]
        .map(([id, run]) => `${name(id)} развитие ${percent(run.before)} → ${percent(run.after)}`)
        .join(', ')
      return {
        kind: 'build',
        icon: 'invest',
        text:
          runs.size > 1
            ? `Развитие городов (${n}), ${[...runs.entries()]
                .map(([id, run]) => `${name(id)} ${percent(run.before)} → ${percent(run.after)}`)
                .join(', ')}`
            : `${list}${times(n)}`,
      }
    }
    case 'ecology_changed': {
      const delta = (group.events as Extract<AnyEvent, { type: 'ecology_changed' }>[]).reduce(
        (s, x) => s + x.delta,
        0,
      )
      const after = (
        group.events[group.events.length - 1] as Extract<AnyEvent, { type: 'ecology_changed' }>
      ).ecology_after
      return {
        kind: 'eco',
        icon: delta > 0 ? 'eco_program' : 'cloud',
        // The cause is a rule id ("bomb_production"), never a country: safe to show.
        text: `Экология ${delta > 0 ? '+' : ''}${delta} → ${percent(after)}${times(n)}`,
      }
    }
    case 'tech_developed':
      return {
        kind: 'war',
        icon: 'nuclear_tech',
        text: `${name(e.actor)} освоила ядерную технологию`,
      }
    case 'bombs_produced': {
      const count = (group.events as Extract<AnyEvent, { type: 'bombs_produced' }>[]).reduce(
        (s, x) => s + x.count,
        0,
      )
      return {
        kind: 'war',
        icon: 'bomb',
        text: `${name(e.actor)} произвела бомб ${count}${times(n)}`,
      }
    }
    case 'shield_built': {
      const cities = [
        ...new Set(
          (group.events as Extract<AnyEvent, { type: 'shield_built' }>[]).map((x) =>
            name(x.target),
          ),
        ),
      ]
      return {
        kind: 'war',
        icon: 'shield',
        text:
          cities.length > 1
            ? `Под ядерным щитом ${cities.join(', ')} (${plural(cities.length, 'город', 'города', 'городов')})`
            : `${cities[0]} под ядерным щитом`,
      }
    }
    case 'nuclear_strike':
      // The author stays hidden: this is the heart of the game's secrecy.
      return {
        kind: 'war',
        icon: 'strike',
        text: `Ядерный удар по ${name(e.target)}, ${STRIKE[e.outcome]}${times(n)}`,
      }
    case 'city_destroyed':
      return { kind: 'war', icon: 'destroyed', text: `Город ${name(e.target)} разрушен` }
    case 'sanction_applied': {
      // Sanctions are public by the rules — the victim is told who imposed them.
      const delta = (group.events as Extract<AnyEvent, { type: 'sanction_applied' }>[]).reduce(
        (s, x) => s + x.delta,
        0,
      )
      return {
        kind: 'deal',
        icon: 'sanction',
        text: `${name(e.actor)} ввела санкции против ${name(e.target)}, развитие −${Math.abs(delta)}${times(n)}`,
      }
    }
    case 'aid_transferred': {
      const amount = (group.events as Extract<AnyEvent, { type: 'aid_transferred' }>[]).reduce(
        (s, x) => s + x.amount,
        0,
      )
      return {
        kind: 'deal',
        icon: 'aid',
        text: `${name(e.actor)} передала ${money(amount)} стране ${name(e.target)}${times(n)}`,
      }
    }
    case 'laugh_awarded':
      return { kind: 'deal', icon: 'laugh', text: `Приз за юмор у ${name(e.target)}` }
    default:
      return null
  }
}

const STRIKE: Record<string, string> = {
  absorbed: 'щит поглотил удар',
  destroyed: 'город разрушен',
  already_destroyed: 'город уже был разрушен',
}
