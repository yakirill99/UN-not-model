/**
 * Merging the round's news: three investments of one bot are three lines of the
 * same story, so they collapse into one — «складывай одинаковые эффекты новости,
 * должна быть объединённая одна новость».
 *
 * Grouping is by (round, kind-of-story): investments of one country fold into a
 * single line with the total effect, several aid payments sum up, a triple strike
 * on the same target counts off with «×3». Different targets of a strike stay
 * separate — that is several news, not one. Pure data, no React: the player's
 * feeds (Changes, Ticker, News) and the projector's feed (watch/feed.ts) all
 * build on this, each with its own wording.
 */
import type { AnyEvent } from './news'

/** One merged story: the events it swallowed, in the engine's own order. */
export type Group = { key: string; events: AnyEvent[] }

/**
 * The story a type belongs to. `null` — never merge (a city destroyed or a
 * laugh awarded is news on its own; bookkeeping lines stay one per fact).
 */
function groupKey(e: AnyEvent): string | null {
  switch (e.type) {
    // Investments fold per country: «бот 3 раза инвестирует» is one story about
    // growth, whether it hit one city three times or three cities once.
    case 'city_invested':
      return `invest|${e.actor ?? ''}`
    case 'bombs_produced':
      return `bombs|${e.actor ?? ''}`
    // Aid folds per direction; sanctions fold per pair; ecology per cause —
    // a bomb's fallout must not merge into an eco programme's gain.
    case 'aid_transferred':
      return `aid|${e.actor ?? ''}|${e.target ?? ''}`
    case 'sanction_applied':
      return `sanction|${e.actor ?? ''}|${e.target ?? ''}`
    case 'ecology_changed':
      return `eco|${e.cause}`
    // Shields over several cities of one country: one line, cities listed.
    case 'shield_built':
      return `shield|${e.actor ?? ''}`
    // Only the same target with the same outcome folds («щит поглотил ×3»);
    // strikes on different cities are different headlines.
    case 'nuclear_strike':
      return `strike|${e.target ?? ''}|${e.outcome}`
    // v2 climate: one round of instability hits one city per country — one
    // headline with the count, not five separate warnings.
    case 'climate_threshold':
      return `climate|${e.level}`
    default:
      return null
  }
}

/**
 * Collapse the news into stories, keeping the order of first mention.
 * Merging stays inside one round: a feed that spans the whole game would
 * otherwise read round 1's investments as part of round 3's.
 */
export function mergeNews(news: AnyEvent[]): Group[] {
  const groups = new Map<string, Group>()
  for (const [i, e] of news.entries()) {
    const story = groupKey(e)
    const key = story ? `${e.round}|${story}` : `solo|${i}`
    const group = groups.get(key)
    if (group) group.events.push(e)
    else groups.set(key, { key, events: [e] })
  }
  return [...groups.values()]
}

/** 3 → «3 хода», 2 → «2 хода», 5 → «5 ходов»: counts read in Russian. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`
  return `${n} ${many}`
}

/** « (×3)» for the merged headlines that need no other wording. */
export function times(n: number): string {
  return n > 1 ? ` (×${n})` : ''
}
