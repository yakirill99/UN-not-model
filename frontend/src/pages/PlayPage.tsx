import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, type Observation } from '../api/client'
import Header from './Header'

/** Player home. Country card (#58) and the orders form (#59) will live here. */
export default function PlayPage() {
  const { gameId } = useParams()
  const [obs, setObs] = useState<Observation | null>(null)

  useEffect(() => {
    if (!gameId) return
    api
      .GET('/api/games/{game_id}/observation', { params: { path: { game_id: gameId } } })
      .then(({ data }) => setObs(data ?? null))
  }, [gameId])

  return (
    <main className="app">
      <Header
        title={obs?.me.name ?? 'Моя страна'}
        subtitle={obs ? `Раунд ${obs.round}` : undefined}
      />
      {obs && (
        <section className="card stack">
          <p>
            Бюджет: <strong>{obs.me.budget} $</strong> · средний уровень жизни{' '}
            <strong>{(obs.me.average_life_level / 100).toFixed(2)} %</strong>
          </p>
          <p className="muted">Карточка страны и форма приказов появятся в следующих задачах.</p>
        </section>
      )}
    </main>
  )
}
