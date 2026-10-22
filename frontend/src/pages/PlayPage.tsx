import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  api,
  errorMessage,
  type ActionSpace,
  type Observation,
  type RoundStatus,
} from '../api/client'
import MyCountry from '../country/MyCountry'
import News from '../country/News'
import Others from '../country/Others'
import { ecologyTone, percent } from '../country/format'
import OrdersForm from '../orders/OrdersForm'
import Header from './Header'

/** Player home: country card (#58) plus the order form of the current round (#59). */
export default function PlayPage() {
  const { gameId } = useParams()
  const [obs, setObs] = useState<Observation | null>(null)
  const [space, setSpace] = useState<ActionSpace | null>(null)
  const [status, setStatus] = useState<RoundStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!gameId) return
    setBusy(true)
    const path = { game_id: gameId }
    const [observation, actions, round] = await Promise.all([
      api.GET('/api/games/{game_id}/observation', { params: { path } }),
      api.GET('/api/games/{game_id}/action-space', { params: { path } }),
      api.GET('/api/games/{game_id}/round', { params: { path } }),
    ])
    setBusy(false)
    if (!observation.data) return setError(errorMessage(observation.error))
    setError(null)
    setObs(observation.data)
    // The action space and the status are absent between rounds — the card stays usable.
    setSpace(actions.data ?? null)
    setStatus(round.data ?? null)
  }, [gameId])

  useEffect(() => {
    void load()
  }, [load])

  const submitted = status ? Object.values(status.submitted).some(Boolean) : false
  const ordersOpen = status?.phase === 'orders'

  return (
    <main className="app">
      <Header
        title={obs?.me.name ?? 'Моя страна'}
        subtitle={obs ? `Раунд ${obs.round}` : undefined}
      />

      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}

      {obs && (
        <div className="stack">
          <div className="row">
            <span className="muted">
              Экология мира:{' '}
              <strong className={ecologyTone(obs.ecology)}>{percent(obs.ecology)}</strong>
            </span>
            <button className="ghost" onClick={() => void load()} disabled={busy}>
              {busy ? 'Обновляем…' : 'Обновить'}
            </button>
          </div>

          <MyCountry me={obs.me} />

          {ordersOpen && space ? (
            <>
              {submitted && (
                <p className="ok">
                  Приказы на этот раунд уже приняты. Новая отправка заменит предыдущую.
                </p>
              )}
              <OrdersForm
                gameId={gameId!}
                space={space}
                observation={obs}
                onSubmitted={() => void load()}
              />
            </>
          ) : (
            <p className="muted">
              {status && !ordersOpen
                ? `Приказы закрыты (${status.phase}). Ждём, пока ведущий подведёт итоги раунда.`
                : 'Приказы сейчас недоступны.'}
            </p>
          )}

          <Others others={obs.others} />
          <News news={obs.news ?? []} />
        </div>
      )}
    </main>
  )
}
