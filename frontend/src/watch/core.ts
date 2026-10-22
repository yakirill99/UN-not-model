/**
 * Turning the host's GameLog into the few series a projector screen can carry.
 *
 * One GET /log holds every round's state_after and every event, so the whole
 * dashboard is computed here, client-side, with no extra endpoint. All functions
 * are pure: the charts and the feed only render what these return.
 */
import type { Schemas } from '../api/client'

export type GameLog = Schemas['GameLog']
export type RoundRecord = NonNullable<GameLog['rounds']>[number]
export type AnyEvent = RoundRecord['events'][number]
export type GameState = Schemas['GameState']

/** A value at a round; round 0 is the start of the game. */
export type Point = { round: number; value: number }

/** One country's line across the game. */
export type Series = { id: string; name: string; points: Point[] }

export function rounds(log: GameLog): RoundRecord[] {
  return log.rounds ?? []
}

/** Ids -> display names, taken from the initial state so they never go missing. */
export function names(log: GameLog): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of log.initial_state.countries) {
    map[c.id] = c.name
    for (const city of c.cities) map[city.id] = city.name
  }
  return map
}

/** States in round order, starting with the initial one, so round 0 is the start. */
function states(log: GameLog): GameState[] {
  return [log.initial_state, ...rounds(log).map((r) => r.state_after)]
}

/**
 * World ecology round by round — the one number that explains most games.
 * Starts at round 0 so the fall from the initial 100 % is visible.
 */
export function ecologyLine(log: GameLog): Point[] {
  return states(log).map((s, i) => ({ round: i, value: s.ecology }))
}

type Country = GameState['countries'][number]

/**
 * A country's score, in whole percent.
 *
 * `average_life_level` is a computed property on the backend's model, so it never
 * reaches the OpenAPI document — it has to be recomputed here. The engine divides by
 * *all* cities, not the surviving ones (state.py): a destroyed city drags the average
 * down with its zero, which is exactly why losing one costs a quarter of the result.
 * life_level arrives in 1/100 of a percent.
 */
export function averageLife(country: Country): number {
  const cities = country.cities
  if (cities.length === 0) return 0
  return cities.reduce((sum, c) => sum + c.life_level, 0) / cities.length / 100
}

/**
 * Average life level per country across the game — the scoreboard, and the headline
 * chart: this is the number the game is won on.
 */
export function lifeLines(log: GameLog): Series[] {
  const all = states(log)
  return log.initial_state.countries.map((c) => ({
    id: c.id,
    name: c.name,
    points: all.map((s, i) => {
      const found = s.countries.find((x) => x.id === c.id)
      return { round: i, value: found ? averageLife(found) : 0 }
    }),
  }))
}

/** Final standings, best first: what the host reads out at the end. */
export function standings(log: GameLog): Series[] {
  return [...lifeLines(log)].sort((a, b) => last(b.points) - last(a.points))
}

export function last(points: Point[]): number {
  return points.length === 0 ? 0 : points[points.length - 1].value
}

/** Events worth counting: what the countries did, not the bookkeeping. */
const DEEDS: Record<string, string> = {
  city_invested: 'Инвестиции',
  ecology_changed: 'Экопрограммы',
  tech_developed: 'Технологии',
  bombs_produced: 'Бомбы',
  nuclear_strike: 'Удары',
  shield_built: 'Щиты',
  sanction_applied: 'Санкции',
  aid_transferred: 'Помощь',
}

export type Slice = { id: string; label: string; count: number }

/**
 * How the game was played, counted over the rounds the host is looking at.
 *
 * `ecology_changed` is emitted by weapons too, so only the positive ones count as
 * programmes; counting all of them would credit a bomb as an act of conservation.
 */
export function deeds(events: AnyEvent[]): Slice[] {
  const counts = new Map<string, number>()
  for (const e of events) {
    if (!(e.type in DEEDS)) continue
    if (e.type === 'ecology_changed' && e.delta <= 0) continue
    counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
  }
  return [...counts]
    .map(([id, count]) => ({ id, label: DEEDS[id], count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
}

/** Every event of the game, oldest first. */
export function allEvents(log: GameLog): AnyEvent[] {
  return rounds(log).flatMap((r) => r.events)
}

export function eventsOfRound(log: GameLog, round: number | null): AnyEvent[] {
  if (round == null) return allEvents(log)
  return rounds(log).find((r) => r.round === round)?.events ?? []
}

/** Bars need a scale; an all-zero chart would divide by zero. */
export function scale(values: number[]): number {
  const top = Math.max(0, ...values)
  return top === 0 ? 1 : top
}
