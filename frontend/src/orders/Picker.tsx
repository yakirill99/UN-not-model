import type { ActionOption } from '../api/client'
import { money } from '../country/format'
import { reasonText } from './core'
import { nameOf, type Names } from './names'

/** Header of one action block: emoji, title, price, and why it is blocked. */
export function ActionHeader({ option }: { option: ActionOption }) {
  return (
    <div className="row action-head">
      <span>
        {option.ui.emoji} {option.ui.title}
      </span>
      <span className="muted">
        {option.available
          ? option.cost > 0
            ? money(option.cost)
            : 'бесплатно'
          : reasonText(option.reason)}
      </span>
    </div>
  )
}

/**
 * Repeatable target picker: `invest` and `strike` accept the same id several times
 * (up to `max_per_target`), so the state is a list, not a set.
 */
export function TargetCounters({
  option,
  names,
  picked,
  left,
  onChange,
  disabled,
}: {
  option: ActionOption
  names: Names
  picked: string[]
  left: number | null
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  const perTarget = option.max_per_target ?? Infinity
  const add = (id: string) => onChange([...picked, id])
  const remove = (id: string) => {
    const at = picked.lastIndexOf(id)
    onChange(picked.filter((_, i) => i !== at))
  }

  return (
    <ul className="targets">
      {(option.targets ?? []).map((id) => {
        const count = picked.filter((t) => t === id).length
        return (
          <li key={id} className="row">
            <span>{nameOf(names, id)}</span>
            <span className="counter">
              <button
                type="button"
                className="ghost"
                aria-label={`Убрать ${nameOf(names, id)}`}
                disabled={disabled || count === 0}
                onClick={() => remove(id)}
              >
                −
              </button>
              <output>{count}</output>
              <button
                type="button"
                className="ghost"
                aria-label={`Добавить ${nameOf(names, id)}`}
                disabled={disabled || count >= perTarget || left === 0}
                onClick={() => add(id)}
              >
                +
              </button>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** One-per-target picker: shields and sanctions are either on or off per target. */
export function TargetToggles({
  option,
  names,
  picked,
  onChange,
  disabled,
}: {
  option: ActionOption
  names: Names
  picked: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}) {
  return (
    <ul className="targets">
      {(option.targets ?? []).map((id) => (
        <li key={id}>
          <label className="row inline">
            <span>{nameOf(names, id)}</span>
            <input
              type="checkbox"
              checked={picked.includes(id)}
              disabled={disabled}
              onChange={(e) =>
                onChange(e.target.checked ? [...picked, id] : picked.filter((t) => t !== id))
              }
            />
          </label>
        </li>
      ))}
    </ul>
  )
}

/** Aid: an amount per recipient; an empty or zero field means "no aid to them". */
export function AidFields({
  option,
  names,
  aid,
  onChange,
  disabled,
}: {
  option: ActionOption
  names: Names
  aid: Record<string, number>
  onChange: (next: Record<string, number>) => void
  disabled?: boolean
}) {
  const set = (id: string, raw: string) => {
    const amount = Number(raw)
    const next = { ...aid }
    if (!raw || Number.isNaN(amount) || amount <= 0) delete next[id]
    else next[id] = amount
    onChange(next)
  }

  return (
    <ul className="targets">
      {(option.targets ?? []).map((id) => (
        <li key={id}>
          <label className="row inline">
            <span>{nameOf(names, id)}</span>
            <input
              type="number"
              min={option.min_amount ?? 1}
              step={1}
              placeholder="0"
              value={aid[id] ?? ''}
              disabled={disabled}
              onChange={(e) => set(id, e.target.value)}
            />
          </label>
        </li>
      ))}
    </ul>
  )
}
