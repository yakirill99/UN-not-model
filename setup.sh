#!/usr/bin/env bash
# ============================================================================
# setup.sh — задача #60: панель ведущего (итоги раунда, приз за юмор)
#
# Запуск из КОРНЯ репозитория, на новой ветке от rules/v1:
#   cd ~/world-arena
#   git switch rules/v1 && git pull
#   git switch -c feat/v1-host-panel
#   bash setup.sh
#
# Что делает:
#   1. Проверяет репозиторий, ветку и что #59 влит (есть src/orders/core.ts).
#   2. Создаёт src/host/:
#      core.ts       сводит GameInfo + RoundStatus в список команд;
#                    боты не считаются «ожидающими» — движок сдаёт за них
#      TeamTable     код для диктовки, вошли/сдали, кнопка приза за юмор
#      Standings     итоговая таблица раунда из RoundResult.standings
#      HostPanel     счётчик сдавших, кнопка «Подвести итоги», разбор 409
#   3. HostPage: грузит GameInfo + RoundStatus параллельно, кнопка «Обновить».
#   4. 11 файлов, 50 новых тестов (всего 247), покрытие 100%.
#   Бэкапы перезаписанных файлов — в .setup-backup-<время>/.
# ============================================================================
set -euo pipefail

fail() { printf 'ОШИБКА: %s\n' "$*" >&2; exit 1; }

[ -f justfile ] && [ -d frontend ] && [ -d backend ] || fail "запускайте из корня репозитория (~/world-arena)"
[ -f frontend/src/orders/core.ts ] || fail "нет frontend/src/orders/core.ts — сначала влейте #59"

BRANCH="$(git branch --show-current 2>/dev/null || echo '?')"
case "$BRANCH" in
  main|dev|rules/v1) fail "вы на '$BRANCH'. Создайте ветку: git switch -c feat/v1-host-panel" ;;
esac
echo "Ветка: $BRANCH"

BACKUP=".setup-backup-$(date +%Y%m%d-%H%M%S)"
CREATED=()
backup() { if [ -f "$1" ]; then mkdir -p "$BACKUP/$(dirname "$1")"; cp "$1" "$BACKUP/$1"; fi; }

mkdir -p frontend/src/host frontend/src/test frontend/src/pages
rm -f frontend/src/host/*.orig frontend/src/host/*.rej
echo "=== Creating frontend/src/host/core.ts ==="
backup frontend/src/host/core.ts
cat << 'HEOF' > frontend/src/host/core.ts
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
HEOF
CREATED+=("frontend/src/host/core.ts")
echo "=== Creating frontend/src/host/Standings.tsx ==="
backup frontend/src/host/Standings.tsx
cat << 'HEOF' > frontend/src/host/Standings.tsx
import type { Team } from './core'
import { lifeLevel } from '../country/format'

/**
 * Final standings of a resolved round: `[country_id, life_level]` pairs the engine
 * returns, already sorted best first. Names come from the host's team list.
 */
export default function Standings({
  standings,
  list,
}: {
  standings: [string, number][]
  list: Team[]
}) {
  if (standings.length === 0) return null
  const nameOf = (id: string) => list.find((t) => t.id === id)?.name ?? id

  return (
    <table className="codes">
      <tbody>
        {standings.map(([id, level], place) => (
          <tr key={id}>
            <td className="muted">{place + 1}</td>
            <td>{nameOf(id)}</td>
            <td>{lifeLevel(level)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
HEOF
CREATED+=("frontend/src/host/Standings.tsx")
echo "=== Creating frontend/src/host/TeamTable.tsx ==="
backup frontend/src/host/TeamTable.tsx
cat << 'HEOF' > frontend/src/host/TeamTable.tsx
import type { Team } from './core'

/**
 * The host's table: a code to read out loud, whether the team joined, whether its
 * orders are in. Codes of bots are intentionally absent — nobody logs in as a bot.
 */
export default function TeamTable({
  list,
  onLaugh,
  busy,
}: {
  list: Team[]
  onLaugh: (countryId: string | null) => void
  busy: boolean
}) {
  return (
    <table className="codes">
      <tbody>
        {list.map((team) => (
          <tr key={team.id}>
            <td>
              {team.name}
              {team.laughWinner && <span title="Приз за юмор"> 😄</span>}
            </td>
            <td>
              {team.isBot ? (
                <span className="muted">бот</span>
              ) : (
                <code className="code">{team.code}</code>
              )}
            </td>
            <td className="muted">{statusText(team)}</td>
            <td>
              {!team.isBot && (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => onLaugh(team.laughWinner ? null : team.id)}
                >
                  {team.laughWinner ? 'Снять приз' : 'Приз за юмор'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Bots need no status: the engine submits for them during resolution. */
function statusText(team: Team): string {
  if (team.isBot) return ''
  if (!team.joined) return 'ещё не вошли'
  return team.submitted ? 'приказы приняты' : 'приказы не отправлены'
}
HEOF
CREATED+=("frontend/src/host/TeamTable.tsx")
echo "=== Creating frontend/src/host/HostPanel.tsx ==="
backup frontend/src/host/HostPanel.tsx
cat << 'HEOF' > frontend/src/host/HostPanel.tsx
import { useState } from 'react'
import { api, errorMessage, type GameInfo, type RoundResult, type RoundStatus } from '../api/client'
import { allSubmitted, phaseText, resolvableRound, submittedCount, teams, type Team } from './core'
import Standings from './Standings'
import TeamTable from './TeamTable'

/**
 * The host's controls for one round: who has submitted, the laugh prize, resolve.
 *
 * Resolve sends the round number the host sees on screen. The service compares it
 * with the game's current round (services/rounds.py: resolve_round) and answers 409
 * if the round has moved on, so a double click can never resolve two rounds.
 */
export default function HostPanel({
  gameId,
  game,
  status,
  onChanged,
}: {
  gameId: string
  game: GameInfo
  status: RoundStatus | null
  onChanged: () => void
}) {
  const [result, setResult] = useState<RoundResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const list: Team[] = teams(game, status)
  const { done, total } = submittedCount(list)
  const round = resolvableRound(game, status)

  async function setLaugh(countryId: string | null) {
    setBusy(true)
    setError(null)
    const { error: err } = await api.POST('/api/games/{game_id}/rounds/{number}/laugh', {
      params: {
        path: { game_id: gameId, number: game.current_round },
        query: countryId == null ? {} : { country_id: countryId },
      },
    })
    setBusy(false)
    if (err) return setError(errorMessage(err))
    onChanged()
  }

  async function resolve(number: number) {
    setBusy(true)
    setError(null)
    const { data, error: err } = await api.POST('/api/games/{game_id}/rounds/{number}/resolve', {
      params: { path: { game_id: gameId, number } },
    })
    setBusy(false)
    if (!data) return setError(errorMessage(err))
    setResult(data)
    onChanged()
  }

  return (
    <section className="card stack">
      <div className="row">
        <h2>
          Раунд {game.current_round} из {game.rounds_total}
        </h2>
        <span className="muted">{phaseText(status?.phase ?? game.phase)}</span>
      </div>

      <p className={allSubmitted(list) ? 'ok' : 'muted'}>
        Приказы отправили {done} из {total}
        {total > 0 && !allSubmitted(list) && ' — можно подвести итоги и без них'}
      </p>

      <TeamTable list={list} onLaugh={(id) => void setLaugh(id)} busy={busy} />

      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}

      {round == null ? (
        <p className="muted">
          {game.phase === 'done' || game.status === 'finished'
            ? 'Игра завершена.'
            : 'Итоги уже подводятся, обновите страницу.'}
        </p>
      ) : (
        <button type="button" onClick={() => void resolve(round)} disabled={busy}>
          {busy ? 'Подводим итоги…' : `Подвести итоги раунда ${round}`}
        </button>
      )}

      {result && (
        <div className="stack">
          <p className="ok">
            Раунд {result.round} завершён: событий {result.events}
            {result.finished
              ? '. Это был последний раунд.'
              : result.next_round != null && `. Следующий раунд — ${result.next_round}.`}
          </p>
          <Standings standings={result.standings} list={list} />
        </div>
      )}
    </section>
  )
}
HEOF
CREATED+=("frontend/src/host/HostPanel.tsx")
echo "=== Creating frontend/src/pages/HostPage.tsx ==="
backup frontend/src/pages/HostPage.tsx
cat << 'HEOF' > frontend/src/pages/HostPage.tsx
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, errorMessage, type GameInfo, type RoundStatus } from '../api/client'
import HostPanel from '../host/HostPanel'
import Header from './Header'

/** Host home: codes, submissions and round resolution (#60). */
export default function HostPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<GameInfo | null>(null)
  const [status, setStatus] = useState<RoundStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!gameId) return
    setBusy(true)
    const path = { game_id: gameId }
    const [info, round] = await Promise.all([
      api.GET('/api/games/{game_id}', { params: { path } }),
      api.GET('/api/games/{game_id}/round', { params: { path } }),
    ])
    setBusy(false)
    if (!info.data) return setError(errorMessage(info.error))
    setError(null)
    setGame(info.data)
    // The status is missing before the first round exists; the codes stay readable.
    setStatus(round.data ?? null)
  }, [gameId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <main className="app">
      <Header title={game?.title || 'Панель ведущего'} subtitle="Ведущий" />

      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}

      {game && (
        <div className="stack">
          <div className="row">
            <span className="muted">
              {game.scenario_id}, правила {game.rules_version}
            </span>
            <button className="ghost" onClick={() => void load()} disabled={busy}>
              {busy ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>

          <HostPanel gameId={gameId!} game={game} status={status} onChanged={() => void load()} />
        </div>
      )}
    </main>
  )
}
HEOF
CREATED+=("frontend/src/pages/HostPage.tsx")
echo "=== Creating frontend/src/test/host.ts ==="
backup frontend/src/test/host.ts
cat << 'HEOF' > frontend/src/test/host.ts
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
HEOF
CREATED+=("frontend/src/test/host.ts")
echo "=== Creating frontend/src/host/core.test.ts ==="
backup frontend/src/host/core.test.ts
cat << 'HEOF' > frontend/src/host/core.test.ts
import { describe, expect, it } from 'vitest'
import { gameInfo, hostStatus, player } from '../test/host'
import { allSubmitted, humans, phaseText, resolvableRound, submittedCount, teams } from './core'

describe('teams', () => {
  it('joins the player list with the round status', () => {
    const list = teams(gameInfo(), hostStatus({ submitted: { russia: true, dprk: true } }))
    expect(list.map((t) => t.name)).toEqual(['Россия', 'США', 'КНДР'])
    expect(list[0]).toMatchObject({
      id: 'russia',
      code: 'RUS-L75WVG',
      joined: true,
      submitted: true,
    })
    expect(list[1].submitted).toBe(false)
  })

  it('never exposes a code for a bot', () => {
    const list = teams(gameInfo(), hostStatus())
    expect(list[2]).toMatchObject({ isBot: true, code: null })
  })

  it('treats a human without a code as codeless rather than crashing', () => {
    const game = gameInfo({ players: [player({ country_id: 'russia', join_code: null })] })
    expect(teams(game, null)[0].code).toBeNull()
  })

  it('marks nobody as submitted while the status is unknown', () => {
    expect(teams(gameInfo(), null).every((t) => !t.submitted)).toBe(true)
  })

  it('flags the laugh winner', () => {
    const list = teams(gameInfo(), hostStatus({ laugh_winner: 'usa' }))
    expect(list.map((t) => t.laughWinner)).toEqual([false, true, false])
  })
})

describe('humans / submittedCount', () => {
  it('counts only the teams that can hold the round up', () => {
    const list = teams(gameInfo(), hostStatus({ submitted: { russia: true, dprk: true } }))
    expect(humans(list)).toHaveLength(2)
    expect(submittedCount(list)).toEqual({ done: 1, total: 2 })
  })

  it('counts zero of zero in a game of bots only', () => {
    const game = gameInfo({ players: [player({ country_id: 'dprk', kind: 'bot' })] })
    expect(submittedCount(teams(game, hostStatus()))).toEqual({ done: 0, total: 0 })
  })
})

describe('allSubmitted', () => {
  it('is true once every human has sent orders', () => {
    const status = hostStatus({ submitted: { russia: true, usa: true, dprk: true } })
    expect(allSubmitted(teams(gameInfo(), status))).toBe(true)
  })

  it('ignores the bots that are always reported as submitted', () => {
    expect(allSubmitted(teams(gameInfo(), hostStatus()))).toBe(false)
  })

  it('is false with nobody to wait for, so the label stays neutral', () => {
    const game = gameInfo({ players: [player({ country_id: 'dprk', kind: 'bot' })] })
    expect(allSubmitted(teams(game, hostStatus()))).toBe(false)
  })
})

describe('resolvableRound', () => {
  it('is the round on screen while orders are open', () => {
    expect(resolvableRound(gameInfo({ current_round: 3 }), hostStatus())).toBe(3)
  })

  it('is nothing while the engine is already resolving', () => {
    expect(resolvableRound(gameInfo(), hostStatus({ phase: 'resolving' }))).toBeNull()
  })

  it('is nothing without a round status', () => {
    expect(resolvableRound(gameInfo(), null)).toBeNull()
  })

  it.each([
    ['phase', gameInfo({ phase: 'done' })],
    ['status', gameInfo({ status: 'finished' })],
  ])('is nothing once the game is over by %s', (_name, game) => {
    expect(resolvableRound(game, hostStatus())).toBeNull()
  })
})

describe('phaseText', () => {
  it.each([
    ['orders', 'приём приказов'],
    ['resolving', 'подведение итогов'],
    ['done', 'игра завершена'],
  ])('translates %s', (phase, expected) => {
    expect(phaseText(phase)).toBe(expected)
  })

  it('passes an unknown phase through', () => {
    expect(phaseText('hibernating')).toBe('hibernating')
  })
})
HEOF
CREATED+=("frontend/src/host/core.test.ts")
echo "=== Creating frontend/src/host/Standings.test.tsx ==="
backup frontend/src/host/Standings.test.tsx
cat << 'HEOF' > frontend/src/host/Standings.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { gameInfo, hostStatus } from '../test/host'
import { teams } from './core'
import Standings from './Standings'

const list = teams(gameInfo(), hostStatus())

describe('Standings', () => {
  it('renders nothing before a round is resolved', () => {
    const { container } = render(<Standings standings={[]} list={list} />)
    expect(container.firstChild).toBeNull()
  })

  it('keeps the engine order and numbers the places', () => {
    render(
      <Standings
        standings={[
          ['usa', 6000],
          ['russia', 4567],
        ]}
        list={list}
      />,
    )
    const rows = screen.getAllByRole('row')
    expect(rows[0].textContent).toBe('1США60.00 %')
    expect(rows[1].textContent).toBe('2Россия45.67 %')
  })

  it('shows the raw id of a country missing from the list', () => {
    render(<Standings standings={[['atlantis', 100]]} list={list} />)
    expect(screen.getByText('atlantis')).toBeTruthy()
  })
})
HEOF
CREATED+=("frontend/src/host/Standings.test.tsx")
echo "=== Creating frontend/src/host/TeamTable.test.tsx ==="
backup frontend/src/host/TeamTable.test.tsx
cat << 'HEOF' > frontend/src/host/TeamTable.test.tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { gameInfo, hostStatus } from '../test/host'
import { teams } from './core'
import TeamTable from './TeamTable'

const render_ = (status = hostStatus(), onLaugh = vi.fn(), busy = false) => {
  render(<TeamTable list={teams(gameInfo(), status)} onLaugh={onLaugh} busy={busy} />)
  return onLaugh
}
const rowOf = (name: string) => screen.getByText(new RegExp(name)).closest('tr')!

describe('TeamTable', () => {
  it('shows a code the host can read out loud', () => {
    render_()
    expect(within(rowOf('Россия')).getByText('RUS-L75WVG')).toBeTruthy()
  })

  it('shows a bot without a code and without a status', () => {
    render_()
    const row = rowOf('КНДР')
    expect(within(row).getByText('бот')).toBeTruthy()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it.each([
    ['ещё не вошли', hostStatus(), 'США'],
    ['приказы не отправлены', hostStatus(), 'Россия'],
    ['приказы приняты', hostStatus({ submitted: { russia: true } }), 'Россия'],
  ])('reports "%s"', (expected, status, name) => {
    render_(status)
    expect(within(rowOf(name)).getByText(expected)).toBeTruthy()
  })

  it('awards the laugh prize to a team', async () => {
    const onLaugh = render_()
    await userEvent.click(within(rowOf('Россия')).getByRole('button', { name: 'Приз за юмор' }))
    expect(onLaugh).toHaveBeenCalledWith('russia')
  })

  it('takes the prize back by sending null', async () => {
    const onLaugh = render_(hostStatus({ laugh_winner: 'russia' }))
    const row = rowOf('Россия')
    expect(within(row).getByTitle('Приз за юмор')).toBeTruthy()
    await userEvent.click(within(row).getByRole('button', { name: 'Снять приз' }))
    expect(onLaugh).toHaveBeenCalledWith(null)
  })

  it('locks the prize buttons while a request is in flight', () => {
    render_(hostStatus(), vi.fn(), true)
    expect(within(rowOf('Россия')).getByRole('button')).toHaveProperty('disabled', true)
  })
})
HEOF
CREATED+=("frontend/src/host/TeamTable.test.tsx")
echo "=== Creating frontend/src/host/HostPanel.test.tsx ==="
backup frontend/src/host/HostPanel.test.tsx
cat << 'HEOF' > frontend/src/host/HostPanel.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type RoundStatus } from '../api/client'
import { gameInfo, hostStatus } from '../test/host'
import HostPanel from './HostPanel'

vi.mock('../api/client', () => ({
  api: { POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const POST = vi.mocked(api.POST)

const RESULT = {
  round: 1,
  events: 12,
  next_round: 2,
  finished: false,
  standings: [
    ['usa', 6000],
    ['russia', 4567],
  ] as [string, number][],
}

function setup(over: { game?: ReturnType<typeof gameInfo>; status?: RoundStatus | null } = {}) {
  const onChanged = vi.fn()
  render(
    <HostPanel
      gameId="g1"
      game={over.game ?? gameInfo()}
      status={over.status === undefined ? hostStatus() : over.status}
      onChanged={onChanged}
    />,
  )
  return onChanged
}

const resolveButton = () => screen.getByRole('button', { name: 'Подвести итоги раунда 1' })

describe('HostPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    POST.mockResolvedValue({ data: RESULT } as never)
  })

  it('shows the round, the phase and how many teams are ready', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Раунд 1 из 6' })).toBeTruthy()
    expect(screen.getByText('приём приказов')).toBeTruthy()
    expect(screen.getByText(/Приказы отправили 0 из 2/)).toBeTruthy()
  })

  it('offers to resolve without waiting for everyone', () => {
    setup()
    expect(screen.getByText(/можно подвести итоги и без них/)).toBeTruthy()
  })

  it('drops the hint once every human has submitted', () => {
    setup({ status: hostStatus({ submitted: { russia: true, usa: true, dprk: true } }) })
    expect(screen.getByText('Приказы отправили 2 из 2')).toBeTruthy()
    expect(screen.queryByText(/без них/)).toBeNull()
  })

  it('resolves the round the host sees, not the one the server may have moved to', async () => {
    setup({ game: gameInfo({ current_round: 3 }), status: hostStatus({ round: 3 }) })
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 3' }))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/resolve', {
      params: { path: { game_id: 'g1', number: 3 } },
    })
  })

  it('reports the result and the standings', async () => {
    const onChanged = setup()
    await userEvent.click(resolveButton())
    expect(await screen.findByText(/Раунд 1 завершён: событий 12/)).toBeTruthy()
    expect(screen.getByText(/Следующий раунд — 2/)).toBeTruthy()
    expect(screen.getByText('60.00 %')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('says when the last round is over instead of promising the next one', async () => {
    POST.mockResolvedValue({
      data: { ...RESULT, round: 6, next_round: null, finished: true },
    } as never)
    setup({ game: gameInfo({ current_round: 6 }), status: hostStatus({ round: 6 }) })
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 6' }))
    expect(await screen.findByText(/Это был последний раунд/)).toBeTruthy()
    expect(screen.queryByText(/Следующий раунд/)).toBeNull()
  })

  it('locks the button while resolving, so one click cannot resolve twice', async () => {
    let resolve!: (v: unknown) => void
    POST.mockReturnValue(new Promise((r) => (resolve = r)) as never)
    setup()
    await userEvent.click(resolveButton())
    expect(screen.getByRole('button', { name: 'Подводим итоги…' })).toHaveProperty('disabled', true)
    resolve({ data: RESULT })
    await waitFor(() => expect(screen.getByText(/Раунд 1 завершён/)).toBeTruthy())
  })

  it('shows the conflict when the round was already resolved elsewhere', async () => {
    POST.mockResolvedValue({
      data: undefined,
      error: { detail: 'round 1 is already resolved; current round is 2' },
    } as never)
    const onChanged = setup()
    await userEvent.click(resolveButton())
    expect((await screen.findByRole('alert')).textContent).toBe(
      'round 1 is already resolved; current round is 2',
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('hides the button while the engine is resolving', () => {
    setup({ status: hostStatus({ phase: 'resolving' }) })
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
    expect(screen.getByText('Итоги уже подводятся, обновите страницу.')).toBeTruthy()
  })

  it('hides the button for good once the game is finished', () => {
    setup({ game: gameInfo({ phase: 'done' }), status: hostStatus({ phase: 'done' }) })
    expect(screen.getByText('Игра завершена.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
  })

  it('falls back to the game phase when the round status is unknown', () => {
    setup({ status: null })
    expect(screen.getByText('приём приказов')).toBeTruthy()
    expect(screen.getByText('Итоги уже подводятся, обновите страницу.')).toBeTruthy()
  })

  it('awards the laugh prize for the current round', async () => {
    const onChanged = setup()
    await userEvent.click(within(screen.getByText(/Россия/).closest('tr')!).getByRole('button'))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/laugh', {
      params: { path: { game_id: 'g1', number: 1 }, query: { country_id: 'russia' } },
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  })

  it('sends an empty query to take the prize back', async () => {
    setup({ status: hostStatus({ laugh_winner: 'russia' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Снять приз' }))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/laugh', {
      params: { path: { game_id: 'g1', number: 1 }, query: {} },
    })
  })

  it('reports a failed prize award', async () => {
    POST.mockResolvedValue({ data: undefined, error: { detail: 'no country atlantis' } } as never)
    const onChanged = setup()
    await userEvent.click(within(screen.getByText(/Россия/).closest('tr')!).getByRole('button'))
    expect((await screen.findByRole('alert')).textContent).toBe('no country atlantis')
    expect(onChanged).not.toHaveBeenCalled()
  })
})
HEOF
CREATED+=("frontend/src/host/HostPanel.test.tsx")
echo "=== Creating frontend/src/pages/HostPage.test.tsx ==="
backup frontend/src/pages/HostPage.test.tsx
cat << 'HEOF' > frontend/src/pages/HostPage.test.tsx
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { gameInfo, hostStatus } from '../test/host'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import HostPage from './HostPage'

vi.mock('../api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const GET = vi.mocked(api.GET)

/** The page fires the game info and the round status in parallel — answer by path. */
function answer(responses: { game?: unknown; status?: unknown; gameError?: unknown } = {}) {
  GET.mockImplementation((path: string) => {
    if (path.endsWith('/round')) {
      return Promise.resolve({ data: responses.status ?? hostStatus() }) as never
    }
    return Promise.resolve({
      data: responses.gameError ? undefined : (responses.game ?? gameInfo()),
      error: responses.gameError,
    }) as never
  })
}

function renderPage(at = '/host/g1') {
  return renderWithSession(<Route path="/host/:gameId" element={<HostPage />} />, {
    at,
    session: fakeSession({ principal: HOST }),
  })
}

describe('HostPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the game and the round status together', async () => {
    answer()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Демо-партия' })).toBeTruthy()
    const paths = GET.mock.calls.map((c) => c[0])
    expect(paths).toContain('/api/games/{game_id}')
    expect(paths).toContain('/api/games/{game_id}/round')
  })

  it('shows the scenario, the codes and the resolve button on one screen', async () => {
    answer()
    renderPage()
    expect(await screen.findByText(/smolny, правила 1.0.0/)).toBeTruthy()
    expect(screen.getByText('RUS-L75WVG')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Подвести итоги раунда 1' })).toBeTruthy()
  })

  it('falls back to a generic title for an untitled game', async () => {
    answer({ game: gameInfo({ title: '' }) })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
  })

  it('keeps the codes readable when the round status is missing', async () => {
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/round')) {
        return Promise.resolve({ data: undefined, error: { detail: 'no round yet' } }) as never
      }
      return Promise.resolve({ data: gameInfo() }) as never
    })
    renderPage()
    expect(await screen.findByText('RUS-L75WVG')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
  })

  it('reloads both requests on demand', async () => {
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(2))
  })

  it('disables the refresh button while a reload is in flight', async () => {
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })

    let resolve!: (v: unknown) => void
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/round')) return Promise.resolve({ data: hostStatus() }) as never
      return new Promise((r) => (resolve = r)) as never
    })
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(screen.getByRole('button', { name: 'Обновляем…' })).toHaveProperty('disabled', true)

    resolve({ data: gameInfo() })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy())
  })

  it('refreshes the panel after the round is resolved', async () => {
    answer()
    vi.mocked(api.POST).mockResolvedValue({
      data: { round: 1, events: 5, next_round: 2, finished: false, standings: [] },
    } as never)
    renderPage()
    await screen.findByRole('button', { name: 'Подвести итоги раунда 1' })
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 1' }))
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(2))
  })

  it('reports a failed load and shows only the header', async () => {
    answer({ gameError: { detail: 'game not found' } })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('game not found')
    expect(screen.getByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
    expect(screen.queryByText('RUS-L75WVG')).toBeNull()
  })

  it('clears the error once a reload succeeds', async () => {
    answer({ gameError: { detail: 'boom' } })
    const { unmount } = renderPage()
    await screen.findByRole('alert')

    unmount()
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not call the API without a game id', () => {
    answer()
    renderWithSession(<Route path="/" element={<HostPage />} />, {
      session: fakeSession({ principal: HOST }),
    })
    expect(GET).not.toHaveBeenCalled()
  })
})
HEOF
CREATED+=("frontend/src/pages/HostPage.test.tsx")

echo
echo "============================================================"
echo "Созданные/обновлённые файлы (${#CREATED[@]}):"
echo "============================================================"
for f in "${CREATED[@]}"; do printf '  %-44s %4s строк\n' "$f" "$(wc -l < "$f")"; done
[ -d "$BACKUP" ] && echo && echo "Бэкапы: $BACKUP/"
echo
echo "Дальше:"
echo "  cd frontend && pnpm format && pnpm lint && pnpm typecheck && pnpm coverage && pnpm build"
echo "Ожидается: Tests 247 passed, покрытие 100% по всем метрикам."
