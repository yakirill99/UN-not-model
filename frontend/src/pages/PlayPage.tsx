import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, errorMessage, type Observation } from '../api/client'
import MyCountry from '../country/MyCountry'
import News from '../country/News'
import Others from '../country/Others'
import { ecologyTone, percent } from '../country/format'
import Header from './Header'

/** Player home: the country card (#58). The orders form (#59) lands below it. */
export default function PlayPage() {
  const { gameId } = useParams()
  const [obs, setObs] = useState<Observation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!gameId) return
    setBusy(true)
    const { data, error: err } = await api.GET('/api/games/{game_id}/observation', {
      params: { path: { game_id: gameId } },
    })
    setBusy(false)
    if (!data) return setError(errorMessage(err))
    setError(null)
    setObs(data)
  }, [gameId])

  // The observation is external state: fetch it when the page opens and whenever
  // the player asks for a refresh. Nothing here can be derived during render.
  useEffect(() => {
    void load()
  }, [load])

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
          <Others others={obs.others} />
          <News news={obs.news ?? []} />

          <p className="muted">Форма приказов появится в следующей задаче.</p>
        </div>
      )}
    </main>
  )
}
