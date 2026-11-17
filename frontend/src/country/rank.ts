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

/** Places that earn a medal: 1, 2 or 3; anything else earns nothing. */
export function medalPlace(place: number): number | null {
  return place >= 1 && place <= 3 ? place : null
}

/**
 * A table where everyone shows the same number has no places yet: round one,
 * all at 0.00 %, would crown every country first at once. Such a field shows
 * no place at all — the first round has not answered «кто первый» yet.
 * The empty field counts as level: nothing there separates anyone.
 */
export function allEqual(values: number[]): boolean {
  return values.every((v) => v === values[0])
}

/**
 * My place among every country I can see (mine included): how many are strictly
 * better, plus one. Equal scores do not count as better — hence shared places.
 */
export function rankOf(me: Me, others: Foreign[]): { place: number; total: number } {
  const better = others.filter((c) => c.average_life_level > me.average_life_level).length
  return { place: better + 1, total: others.length + 1 }
}
