/**
 * The projector view: what the room sees between rounds.
 *
 * Built from one GET /log — it carries every round's state and events, so the whole
 * dashboard refreshes with a single request. The feed is deliberately anonymised
 * (see feed.ts): the host knows who struck, the screen must not say it.
 */
import { useMemo, useState } from 'react'
import { DeedsChart, EcologyChart, Legend, LifeChart } from './Charts'
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
  const [kinds, setKinds] = useState<Set<Kind>>(new Set())

  const played = rounds(log)
  const label = names(log)
  const events = useMemo(() => eventsOfRound(log, round), [log, round])
  const entries = useMemo(() => filterKinds(feed(events, label), kinds), [events, label, kinds])
  const slices = useMemo(() => deeds(events), [events])

  function toggle(kind: Kind) {
    setKinds((prev) => {
      const next = new Set(prev)
      if (!next.delete(kind)) next.add(kind)
      return next
    })
  }

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
        <Legend series={standings(log)} />
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

        <div className="chips">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kinds.has(k.id) ? 'chip on' : 'chip'}
              onClick={() => toggle(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>

        {slices.length > 0 && <DeedsChart slices={slices} />}

        {entries.length === 0 ? (
          <p className="muted">Под эти фильтры ничего не попало.</p>
        ) : (
          <ul className="feed">
            {entries.map((e) => (
              <li key={e.key}>
                <span className="feed-icon">{e.icon}</span>
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
