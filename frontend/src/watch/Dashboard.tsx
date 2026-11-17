/**
 * The projector view: what the room sees between rounds.
 *
 * Built from one GET /log — it carries every round's state and events, so the whole
 * dashboard refreshes with a single request. The feed is deliberately anonymised
 * (see feed.ts): the host knows who struck, the screen must not say it.
 */
import { useMemo, useState } from 'react'
import { Icon } from '../ui/Icon'
import { DeedsChart, EcologyChart, LifeChart, StandingsLegend } from './Charts'
import {
  deeds,
  ecologyLine,
  eventsOfRound,
  lifeLines,
  names,
  rounds,
  standings,
  type GameLog,
} from './core'
import { feed, filterKinds, KINDS, type Kind } from './feed'

export default function Dashboard({ log }: { log: GameLog }) {
  const [round, setRound] = useState<number | null>(null)
  // Both filters are switches, not stacks («режим переключения между фильтрами,
  // а не наложение»): one round and one kind selected at a time, null = all.
  const [kind, setKind] = useState<Kind | null>(null)

  const played = rounds(log)
  const label = names(log)
  const events = useMemo(() => eventsOfRound(log, round), [log, round])
  const entries = useMemo(() => filterKinds(feed(events, label), kind), [events, label, kind])
  const slices = useMemo(() => deeds(events), [events])

  if (played.length === 0) {
    return (
      <section className="card">
        <p className="muted">
          Пока нечего показать: диаграммы появятся после первого подведения итогов.
        </p>
      </section>
    )
  }

  return (
    <div className="stack">
      <section className="card stack">
        <h3>Уровень жизни стран</h3>
        <LifeChart series={lifeLines(log)} />
        <StandingsLegend series={standings(log)} />
      </section>

      <section className="card stack">
        <h3>Экология мира</h3>
        <EcologyChart points={ecologyLine(log)} />
        <p className="muted">
          Ниже 40 % планета в беде. Экология входит и в уровень жизни, и в доход каждого города.
        </p>
      </section>

      <section className="card stack">
        <div className="row">
          <h3>События</h3>
          <span className="muted">
            {round == null ? 'вся игра' : `раунд ${round}`} · {entries.length}
          </span>
        </div>

        <div className="chips">
          <button
            type="button"
            className={round == null ? 'chip on' : 'chip'}
            onClick={() => setRound(null)}
          >
            Вся игра
          </button>
          {played.map((r) => (
            <button
              key={r.round}
              type="button"
              className={round === r.round ? 'chip on' : 'chip'}
              onClick={() => setRound(r.round)}
            >
              Раунд {r.round}
            </button>
          ))}
        </div>

        <div className="chips" role="group" aria-label="Фильтр по типу событий">
          <button
            type="button"
            className={kind == null ? 'chip on' : 'chip'}
            aria-pressed={kind == null}
            onClick={() => setKind(null)}
          >
            Все
          </button>
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kind === k.id ? 'chip on' : 'chip'}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        {slices.length > 0 && <DeedsChart slices={slices} />}

        {entries.length === 0 ? (
          <p className="muted">Под этот фильтр ничего не попало.</p>
        ) : (
          <ul className="feed">
            {entries.map((e) => (
              <li key={e.key}>
                <span className="feed-icon" aria-hidden="true">
                  <Icon name={e.icon} size={18} />
                </span>
                <span className="feed-round">{e.round}</span>
                {e.text}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
