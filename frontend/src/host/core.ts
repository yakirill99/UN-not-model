/**
 * Reading the host's two sources of truth: GameInfo (who plays, which codes) and
 * RoundStatus (whose orders are in, who wins the laugh prize).
 *
 * `submitted` only lists countries, so the names come from GameInfo. Bots are always
 * reported as submitted — the engine fills their orders at resolve time — so the host
 * must not wait for them.
 */
import type { GameInfo, RoundStatus, Schemas } from '../api/client'

export type Player = Schemas['PlayerInfo']

/** One row of the host's table: a country, its code and whether its orders are in. */
export type Team = {
  id: string
  name: string
  isBot: boolean
  code: string | null
  joined: boolean
  submitted: boolean
  laughWinner: boolean
}

export function teams(game: GameInfo, status: RoundStatus | null): Team[] {
  return game.players.map((p) => ({
    id: p.country_id,
    name: p.name,
    isBot: p.kind !== 'human',
    code: p.kind === 'human' ? (p.join_code ?? null) : null,
    joined: p.joined,
    submitted: status?.submitted[p.country_id] ?? false,
    laughWinner: status?.laugh_winner === p.country_id,
  }))
}

/** Humans only: bots never hold the round up, so they are not part of the count. */
export function humans(list: Team[]): Team[] {
  return list.filter((t) => !t.isBot)
}

export function submittedCount(list: Team[]): { done: number; total: number } {
  const people = humans(list)
  return { done: people.filter((t) => t.submitted).length, total: people.length }
}

/** Everyone who can still act has sent orders — the host may resolve without waiting. */
export function allSubmitted(list: Team[]): boolean {
  const { done, total } = submittedCount(list)
  return total > 0 && done === total
}

/** The host resolves the round the game is on; `null` outside the orders phase. */
export function resolvableRound(game: GameInfo, status: RoundStatus | null): number | null {
  if (game.phase === 'done' || game.status === 'finished') return null
  return status?.phase === 'orders' ? game.current_round : null
}

export const PHASES: Record<string, string> = {
  orders: 'приём приказов',
  resolving: 'подведение итогов',
  done: 'игра завершена',
}

export function phaseText(phase: string): string {
  return PHASES[phase] ?? phase
}
