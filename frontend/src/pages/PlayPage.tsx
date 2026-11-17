import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'
import { useAutoRefresh } from '../useAutoRefresh'
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
import Ticker from '../country/Ticker'
import { namesOf } from '../country/names'
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

  const [banner, setBanner] = useState<number | null>(null)
  const seenRound = useRef<number | null>(null)
  // The previous round's city life levels: the «Участники» tab colours each
  // city chip by its change (grew green, fell red). Empty until the round moves.
  const [prevLife, setPrevLife] = useState<Map<string, number>>(new Map())
  const lastObs = useRef<Observation | null>(null)

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
    // A new round deserves a beat of theatre: the banner says the results are
    // in («анимация перехода между раундами»). The very first load stays quiet.
    const next = observation.data.round
    if (seenRound.current != null && next !== seenRound.current) setBanner(next)
    seenRound.current = next
    // The round moved: the observation we held until now IS the previous
    // round's world — snapshot its city life levels for the change colours.
    const prev = lastObs.current
    if (prev && prev.round !== next) {
      const map = new Map<string, number>()
      for (const c of prev.me.cities) map.set(c.id, c.life_level)
      for (const o of prev.others) for (const c of o.cities) map.set(c.id, c.life_level)
      setPrevLife(map)
    }
    lastObs.current = observation.data
    // The action space and the status are absent between rounds — the card stays usable.
    setSpace(actions.data ?? null)
    setStatus(round.data ?? null)
  }, [gameId])

  useEffect(() => {
    void load()
  }, [load])

  // The round resolves on the host's machine; every player's page catches up
  // on its own — no F5 marathon in the room.
  useAutoRefresh(load)

  useEffect(() => {
    if (banner == null) return
    const t = window.setTimeout(() => setBanner(null), 3600)
    return () => window.clearTimeout(t)
  }, [banner])

  const submitted = status ? Object.values(status.submitted).some(Boolean) : false
  const ordersOpen = status?.phase === 'orders'
  // One dictionary for every feed: engine events speak in ids, players read names.
  const names = obs ? namesOf(obs) : {}

  return (
    <>
      {/* The played nation in the SIDE GUTTERS only (#world): one file per
          country in /public/flags. It lives OUTSIDE <main> — inside it the
          fixed layer sat in .app's own stacking context and outpainted every
          card that had no z-index of its own. The URL rides in a CSS custom
          property: the element itself paints nothing, its two pseudo-element
          stripes do. */}
      {obs && (
        <div
          className="flag-bg"
          style={{ '--flag': `url("${flagUrl(obs.me.name)}")` } as React.CSSProperties}
          aria-hidden="true"
        />
      )}

      {/* The round transition (#hall): a beat of theatre while the numbers move. */}
      {banner != null && (
        <div className="round-banner" role="status" key={banner}>
          <strong>Раунд {banner}</strong>
          <span>Итоги подведены — данные обновились сами</span>
        </div>
      )}

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
            {/* Sticky header travels with the scroll: key numbers AND the menu
              stay visible — «плашка меню тоже опускается вниз». */}
            <div className="playhead">
              <StatusStrip
                me={obs.me}
                ecology={obs.ecology}
                others={obs.others}
                forecast={obs.income_forecast}
                action={
                  <button className="ghost" onClick={() => void load()} disabled={busy}>
                    {busy ? 'Обновляем…' : 'Обновить'}
                  </button>
                }
              />

              {/* The crawling one-liner of the round (#5): news without scrolling. */}
              <Ticker news={obs.news ?? []} names={names} />

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
              <Others others={obs.others} me={obs.me} prevLife={prevLife} />
            </div>

            <div
              className="stack"
              role="tabpanel"
              id="panel-news"
              aria-labelledby="tab-news"
              hidden={tab !== 'news'}
            >
              {/* What the last resolved round changed, worst first (#6). */}
              <Changes news={obs.news ?? []} names={names} />
              <News news={obs.news ?? []} names={names} />
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
    </>
  )
}
