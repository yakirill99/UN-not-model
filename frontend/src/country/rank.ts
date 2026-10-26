/**
 * Places and medals for the «кто первый» question (#2).
 *
 * The engine gives no ranking endpoint, but every visible country carries its
 * average life level, so the places are computed here, client-side. Ties share
 * a place: two countries with the same top score are both first, like in
 * figure skating, and nobody falls to second because of a coin flip.
 */
import type { Schemas } from '../api/client'

type Me = Schemas['OwnCountryView']
type Foreign = Schemas['ForeignCountryView']

/** Places that earn a medal on the projector and in the summary. */
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

export function medalFor(place: number): string {
  return MEDALS[place] ?? ''
}

/**
 * My place among every country I can see (mine included): how many are strictly
 * better, plus one. Equal scores do not count as better — hence shared places.
 */
export function rankOf(me: Me, others: Foreign[]): { place: number; total: number } {
  const better = others.filter((c) => c.average_life_level > me.average_life_level).length
  return { place: better + 1, total: others.length + 1 }
}
