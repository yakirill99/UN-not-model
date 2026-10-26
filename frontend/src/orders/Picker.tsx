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

/**
 * Numeric field for a single count: a thumb-sized − / + around the number input.
 * The input stays a spinbutton (arrows, paste, external keyboards), the buttons
 * cover the phone case from the playtest feedback («цифры вводить неудобно»).
 * `max == null` means the rules set no per-round limit.
 */
export function NumberStepper({
  label,
  noun,
  value,
  max,
  onChange,
  disabled,
}: {
  /** Accessible label of the number input itself («Сколько бомб»). */
  label: string
  /** Accusative noun for the ± buttons («бомбу») — kept separate so label
   *  queries (getByLabelText) match only the input. */
  noun: string
  value: number
  max: number | null
  onChange: (next: number) => void
  disabled?: boolean
}) {
  const clamp = (n: number) => {
    if (Number.isNaN(n)) return 0
    return max == null ? Math.max(0, n) : Math.min(Math.max(0, n), max)
  }
  return (
    <span className="counter">
      <button
        type="button"
        className="ghost"
        aria-label={`Убрать ${noun}`}
        disabled={disabled || value <= 0}
        onClick={() => onChange(clamp(value - 1))}
      >
        −
      </button>
      <input
        type="number"
        min={0}
        max={max ?? undefined}
        step={1}
        value={value}
        aria-label={label}
        disabled={disabled}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      <button
        type="button"
        className="ghost"
        aria-label={`Добавить ${noun}`}
        disabled={disabled || (max != null && value >= max)}
        onClick={() => onChange(clamp(value + 1))}
      >
        +
      </button>
    </span>
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
