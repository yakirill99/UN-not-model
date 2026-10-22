import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, errorMessage, type GameInfo, type RoundStatus } from '../api/client'
import HostPanel from '../host/HostPanel'
import Dashboard from '../watch/Dashboard'
import type { GameLog } from '../watch/core'
import Header from './Header'

/** Host home: codes, submissions and round resolution (#60). */
export default function HostPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<GameInfo | null>(null)
  const [status, setStatus] = useState<RoundStatus | null>(null)
  const [log, setLog] = useState<GameLog | null>(null)
  const [watching, setWatching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!gameId) return
    setBusy(true)
    const path = { game_id: gameId }
    const [info, round, journal] = await Promise.all([
      api.GET('/api/games/{game_id}', { params: { path } }),
      api.GET('/api/games/{game_id}/round', { params: { path } }),
      api.GET('/api/games/{game_id}/log', { params: { path } }),
    ])
    setBusy(false)
    if (!info.data) return setError(errorMessage(info.error))
    setError(null)
    setGame(info.data)
    // The status is missing before the first round exists; the codes stay readable.
    setStatus(round.data ?? null)
    // The log carries every round: one request feeds all the charts.
    setLog(journal.data ?? null)
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
            <span className="row">
              <button
                className={watching ? 'chip on' : 'chip'}
                onClick={() => setWatching((v) => !v)}
              >
                {watching ? 'Скрыть экран' : 'Экран для зала'}
              </button>
              <button className="ghost" onClick={() => void load()} disabled={busy}>
                {busy ? 'Обновляем…' : 'Обновить'}
              </button>
            </span>
          </div>

          {/* The projector view: anonymised events and the charts of the whole game. */}
          {watching && log && <Dashboard log={log} />}

          <HostPanel gameId={gameId!} game={game} status={status} onChanged={() => void load()} />
        </div>
      )}
    </main>
  )
}
