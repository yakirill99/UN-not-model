import type { Schemas } from '../api/client'

/** Human names for the ids the engine speaks: cities and countries. */
export type Names = Record<string, string>

/** An id with no name is shown as is — a missing translation must not hide a target. */
export function nameOf(names: Names, id: string | null | undefined): string {
  return (id != null && names[id]) || (id ?? '')
}

/**
 * The id → name dictionary from an observation, for the news feed and the
 * world map: engine events carry raw ids (`spb`, `usa`), players read
 * «Санкт-Петербург». `foreignPrefix` qualifies foreign cities with their
 * country («США · Нью-Йорк») — the order form needs it to disambiguate
 * strike targets; the news reads better without the prefix.
 */
export function namesOf(
  obs: Schemas['Observation'],
  { foreignPrefix = false }: { foreignPrefix?: boolean } = {},
): Names {
  const map: Names = {}
  // Me first: a sanction against me names ME («Санкции от США → Россия»),
  // and my id lives on obs.me, not in obs.others.
  map[obs.me.id] = obs.me.name
  for (const city of obs.me.cities) map[city.id] = city.name
  for (const country of obs.others) {
    map[country.id] = country.name
    for (const city of country.cities) {
      map[city.id] = foreignPrefix ? `${country.name} · ${city.name}` : city.name
    }
  }
  return map
}
