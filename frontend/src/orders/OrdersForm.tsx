import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage, orderErrors, type ActionSpace, type Observation } from '../api/client'
import { money } from '../country/format'
import {
  countLeft,
  emptyDraft,
  isEmpty,
  pruneDraft,
  reasonText,
  toBody,
  totalCost,
  usedCount,
  type Draft,
} from './core'
import { nameOf, type Names } from './names'
import { ActionHeader, AidFields, TargetCounters, TargetToggles } from './Picker'

/**
 * The order form for one round.
 *
 * Every field comes from `ActionSpace`: the engine decides what is available, how
 * much it costs and which targets are legal (engine/actions.py). The form only
 * previews the budget and keeps the player inside the limits; the authoritative
 * check happens again in PUT /orders, whose `errors[]` is shown per action.
 *
 * The draft is pruned whenever the action space changes. PlayPage also remounts the
 * form on a new round (`key={space.round}`), but a space can change within one round
 * too — after a submission is reloaded — and a stale pick would then be charged for
 * while its control is hidden, leaving the player unable to submit at all.
 */
export default function OrdersForm({
  gameId,
  space,
  observation,
  onSubmitted,
}: {
  gameId: string
  space: ActionSpace
  observation: Observation
  onSubmitted: () => void
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft)

  // What the rules no longer allow cannot stay in the draft (see pruneDraft).
  useEffect(() => setDraft((d) => pruneDraft(d, space)), [space])
  const [errors, setErrors] = useState<Record<string, string[]>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  /** Ids the engine uses -> names the player reads: own cities, foreign cities, countries. */
  const names: Names = useMemo(() => {
    const map: Names = {}
    for (const city of observation.me.cities) map[city.id] = city.name
    for (const country of observation.others) {
      map[country.id] = country.name
      for (const city of country.cities) map[city.id] = `${country.name} · ${city.name}`
    }
    return map
  }, [observation])

  const spent = totalCost(draft, space)
  const left = space.budget - spent
  const patch = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }))
    setDone(false)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    setMessage(null)
    const { error } = await api.PUT('/api/games/{game_id}/orders', {
      params: { path: { game_id: gameId } },
      body: toBody(draft),
    })
    setBusy(false)
    if (!error) {
      setDone(true)
      onSubmitted()
      return
    }
    const rejected = orderErrors(error)
    if (rejected.length === 0) return setMessage(errorMessage(error))
    const byAction: Record<string, string[]> = {}
    for (const item of rejected) {
      const target = item.target ? `${nameOf(names, item.target)}: ` : ''
      ;(byAction[item.action] ??= []).push(`${target}${reasonText(item.reason)}`)
    }
    setErrors(byAction)
  }

  const block = (id: string, children?: React.ReactNode) => {
    const option = space.actions[id]
    if (!option) return null
    const problems = errors[id] ?? []
    return (
      <section className={option.available ? 'action' : 'action off'}>
        <ActionHeader option={option} />
        {option.available && children}
        {problems.length > 0 && (
          <p className="bad" role="alert">
            {problems.join('; ')}
          </p>
        )}
      </section>
    )
  }

  const counters = (id: string, key: 'invest' | 'strikes') => {
    const option = space.actions[id]
    return (
      <TargetCounters
        option={option}
        names={names}
        picked={draft[key]}
        left={countLeft(option, usedCount(draft, id))}
        disabled={busy}
        onChange={(next) => patch({ [key]: next } as Partial<Draft>)}
      />
    )
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="row">
        <h2>Приказы на раунд {space.round}</h2>
        <span className={left < 0 ? 'bad' : 'muted'}>
          Потрачено {money(spent)} из {money(space.budget)}
        </span>
      </div>

      {block('invest', counters('invest', 'invest'))}

      {block(
        'eco_program',
        <label className="row inline">
          <span>Сколько программ</span>
          <input
            type="number"
            min={0}
            step={1}
            value={draft.eco_programs}
            disabled={busy}
            onChange={(e) => patch({ eco_programs: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>,
      )}

      {block(
        'nuclear_tech',
        <label className="row inline">
          <span>Разработать в этом раунде</span>
          <input
            type="checkbox"
            checked={draft.nuclear_tech}
            disabled={busy}
            onChange={(e) => patch({ nuclear_tech: e.target.checked })}
          />
        </label>,
      )}

      {block(
        'bomb',
        <label className="row inline">
          <span>
            Сколько бомб
            {space.actions.bomb.max_count != null && (
              <span className="muted"> (не больше {space.actions.bomb.max_count})</span>
            )}
          </span>
          <input
            type="number"
            min={0}
            max={space.actions.bomb.max_count ?? undefined}
            step={1}
            value={draft.bombs}
            disabled={busy}
            onChange={(e) => patch({ bombs: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>,
      )}

      {block('strike', counters('strike', 'strikes'))}

      {block(
        'shield',
        <TargetToggles
          option={space.actions.shield}
          names={names}
          picked={draft.shields}
          disabled={busy}
          onChange={(shields) => patch({ shields })}
        />,
      )}

      {block(
        'sanction',
        <TargetToggles
          option={space.actions.sanction}
          names={names}
          picked={draft.sanctions}
          disabled={busy}
          onChange={(sanctions) => patch({ sanctions })}
        />,
      )}

      {block(
        'aid',
        <AidFields
          option={space.actions.aid}
          names={names}
          aid={draft.aid}
          disabled={busy}
          onChange={(aid) => patch({ aid })}
        />,
      )}

      {message && (
        <p className="bad" role="alert">
          {message}
        </p>
      )}
      {done && <p className="ok">Приказы отправлены. Их можно переотправить до конца раунда.</p>}

      <button type="submit" disabled={busy || left < 0 || isEmpty(draft)}>
        {busy ? 'Отправляем…' : 'Отправить приказы'}
      </button>
      {left < 0 && <p className="muted">Расходы превышают бюджет на {money(-left)}.</p>}
    </form>
  )
}
