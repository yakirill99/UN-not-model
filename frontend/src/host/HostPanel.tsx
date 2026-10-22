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
