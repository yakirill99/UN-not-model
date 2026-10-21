/** Builders for GameInfo / RoundStatus fixtures as the host sees them. */
import type { GameInfo, RoundStatus, Schemas } from '../api/client'

type Player = Schemas['PlayerInfo']

export function player(over: Partial<Player> & { country_id: string }): Player {
  return {
    name: over.country_id,
    kind: 'human',
    join_code: null,
    joined: false,
    ...over,
  }
}

/** Two human teams and one bot — the shape of a demo game. */
export function gameInfo(over: Partial<GameInfo> = {}): GameInfo {
  return {
    id: 'g1',
    title: 'Демо-партия',
    current_round: 1,
    rounds_total: 6,
    scenario_id: 'smolny',
    rules_version: '1.0.0',
    mode: 'live',
    phase: 'orders',
    status: 'active',
    seed: 1,
    host_code: 'HOST-DZRS3A',
    players: [
      player({ country_id: 'russia', name: 'Россия', join_code: 'RUS-L75WVG', joined: true }),
      player({ country_id: 'usa', name: 'США', join_code: 'USA-N4FTJ7', joined: false }),
      player({ country_id: 'dprk', name: 'КНДР', kind: 'bot' }),
    ],
    ...over,
  }
}

export function hostStatus(over: Partial<RoundStatus> = {}): RoundStatus {
  return {
    round: 1,
    phase: 'orders',
    status: 'active',
    submitted: { russia: false, usa: false, dprk: true },
    laugh_winner: null,
    ...over,
  }
}
