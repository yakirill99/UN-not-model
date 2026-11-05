import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  api,
  errorMessage,
  type ActionSpace,
  type Observation,
  type RoundStatus,
} from '../api/client'
import Changes from '../country/Changes'
import MyCountry from '../country/MyCountry'
import News from '../country/News'
import Others from '../country/Others'
import StatusStrip from '../country/StatusStrip'
import OrdersForm from '../orders/OrdersForm'
import WorldTab from '../world/WorldTab'
import { flagUrl } from '../world/flags'
import Header from './Header'

/** The screens of one player page; «Страна» is where the round is played.
    «Мир» is experimental: a schematic map with manual diplomacy (#world). */
const TABS = [
  { id: 'country', label: 'Страна' },
  { id: 'others', label: 'Участники' },
  { id: 'news', label: 'Новости' },
  { id: 'world', label: 'Мир' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Player home: country card (#58) plus the order form of the current round (#59). */
export default function PlayPage() {
  const { gameId } = useParams()
  const [obs, setObs] = useState<Observation | null>(null)
  const [space, setSpace] = useState<ActionSpace | null>(null)
  const [status, setStatus] = useState<RoundStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<TabId>('country')

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
      {/* The played nation behind everything (#world): one file per country
          in /public/flags — swap the file, swap the banner. */}
      {obs && (
        <div
          className="flag-bg"
          style={{ backgroundImage: `url("${flagUrl(obs.me.name)}")` }}
          aria-hidden="true"
        />
      )}

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
          {/* Sticky header travels with the scroll: key numbers AND the menu
              stay visible — «плашка меню тоже опускается вниз». */}
          <div className="playhead">
            <StatusStrip
              me={obs.me}
              ecology={obs.ecology}
              others={obs.others}
              action={
                <button className="ghost" onClick={() => void load()} disabled={busy}>
                  {busy ? 'Обновляем…' : 'Обновить'}
                </button>
              }
            />

            <nav className="tabs" role="tablist" aria-label="Разделы">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls={`panel-${t.id}`}
                  className={tab === t.id ? 'tab on' : 'tab'}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* All panels stay mounted; `hidden` hides the inactive ones. That is
              what keeps the half-filled order form alive across tab switches. */}
          <div
            className="stack"
            role="tabpanel"
            id="panel-country"
            aria-labelledby="tab-country"
            hidden={tab !== 'country'}
          >
            <MyCountry me={obs.me} />

            {ordersOpen && space ? (
              <>
                {submitted && (
                  <p className="ok">
                    Приказы на этот раунд уже приняты. Новая отправка заменит предыдущую.
                  </p>
                )}
                {/* A new round is a new form: remounting drops the previous draft. */}
                <OrdersForm
                  key={space.round}
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
          </div>

          <div
            role="tabpanel"
            id="panel-others"
            aria-labelledby="tab-others"
            hidden={tab !== 'others'}
          >
            <Others others={obs.others} me={obs.me} />
          </div>

          <div
            className="stack"
            role="tabpanel"
            id="panel-news"
            aria-labelledby="tab-news"
            hidden={tab !== 'news'}
          >
            {/* What the last resolved round changed, worst first (#6). */}
            <Changes news={obs.news ?? []} />
            <News news={obs.news ?? []} />
          </div>

          <div
            className="stack"
            role="tabpanel"
            id="panel-world"
            aria-labelledby="tab-world"
            hidden={tab !== 'world'}
          >
            <WorldTab obs={obs} gameId={gameId} />
          </div>
        </div>
      )}
    </main>
  )
}
