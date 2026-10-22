/** Builders for a GameLog as the host's dashboard reads it. */
import type { GameLog, GameState, RoundRecord } from '../watch/core'

type Country = GameState['countries'][number]
type City = Country['cities'][number]
type AnyEvent = RoundRecord['events'][number]

export function city(over: Partial<City> & { id: string }): City {
  return {
    name: over.id,
    development: 60,
    shield: false,
    destroyed: false,
    life_level: 5000,
    ...over,
  }
}

export function country(over: Partial<Country> & { id: string }): Country {
  return {
    name: over.id,
    budget: 1000,
    cities: [city({ id: `${over.id}-1` }), city({ id: `${over.id}-2` })],
    nuclear_tech: false,
    bombs: 0,
    bombs_pending: 0,
    laugh: 0,
    aid_pending: 0,
    sanctioned_by: [],
    ...over,
  }
}

export function state(over: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    ecology: 100,
    countries: [
      country({
        id: 'russia',
        name: 'Россия',
        cities: [
          city({ id: 'russia-1', name: 'Москва' }),
          city({ id: 'russia-2', name: 'Петербург' }),
        ],
      }),
      country({
        id: 'usa',
        name: 'США',
        cities: [city({ id: 'usa-1', name: 'Вашингтон' }), city({ id: 'usa-2', name: 'Нью-Йорк' })],
      }),
    ],
    modules: {},
    state_schema_version: 1,
    ...over,
  }
}

/** Events carry `round`; the builder fills it so tests stay about the payload. */
export function event(over: Partial<AnyEvent> & { type: string }): AnyEvent {
  return { schema_version: 1, round: 1, actor: null, target: null, ...over } as AnyEvent
}

export function record(over: Partial<RoundRecord> & { round: number }): RoundRecord {
  return {
    orders: { orders: {}, host: { laugh_winner: null } },
    events: [],
    state_after: state({ round: over.round }),
    ...over,
  }
}

export function gameLog(over: Partial<GameLog> = {}): GameLog {
  return {
    log_schema_version: 1,
    rules_version: '1.0.0',
    rules_snapshot: { version: '1.0.0', actions: {} } as GameLog['rules_snapshot'],
    scenario_id: 'smolny',
    seed: 1,
    initial_state: state(),
    rounds: [],
    ...over,
  }
}

/**
 * A two-round game: ecology falls from 100 to 70, Russia pulls ahead and the USA
 * loses a city. Enough shape for every chart and both feed rules.
 */
export function playedLog(): GameLog {
  const after1 = state({
    round: 1,
    ecology: 85,
    countries: [
      country({
        id: 'russia',
        name: 'Россия',
        cities: [
          city({ id: 'russia-1', name: 'Москва', life_level: 6000 }),
          city({ id: 'russia-2', name: 'Петербург' }),
        ],
      }),
      country({
        id: 'usa',
        name: 'США',
        cities: [city({ id: 'usa-1', name: 'Вашингтон' }), city({ id: 'usa-2', name: 'Нью-Йорк' })],
      }),
    ],
  })
  const after2 = state({
    round: 2,
    ecology: 70,
    countries: [
      country({
        id: 'russia',
        name: 'Россия',
        cities: [
          city({ id: 'russia-1', name: 'Москва', life_level: 7000 }),
          city({ id: 'russia-2', name: 'Петербург' }),
        ],
      }),
      country({
        id: 'usa',
        name: 'США',
        cities: [
          city({ id: 'usa-1', name: 'Вашингтон', destroyed: true, life_level: 0 }),
          city({ id: 'usa-2', name: 'Нью-Йорк' }),
        ],
      }),
    ],
  })
  return gameLog({
    rounds: [
      record({
        round: 1,
        state_after: after1,
        events: [
          event({
            type: 'city_invested',
            actor: 'russia',
            target: 'russia-1',
            round: 1,
            development_before: 60,
            development_after: 75,
          }),
          event({
            type: 'ecology_changed',
            round: 1,
            cause: 'bomb_production',
            delta: -15,
            ecology_after: 85,
          }),
          event({
            type: 'budget_spent',
            actor: 'russia',
            round: 1,
            action: 'invest',
            amount: 150,
            budget_after: 850,
          }),
        ],
      }),
      record({
        round: 2,
        state_after: after2,
        events: [
          event({
            type: 'nuclear_strike',
            actor: 'russia',
            target: 'usa-1',
            round: 2,
            outcome: 'destroyed',
          }),
          event({
            type: 'city_destroyed',
            actor: 'russia',
            target: 'usa-1',
            round: 2,
            cause: 'nuclear_strike',
          }),
          event({
            type: 'ecology_changed',
            round: 2,
            cause: 'eco_program',
            delta: 30,
            ecology_after: 70,
          }),
        ],
      }),
    ],
  })
}
