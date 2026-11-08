import type { ActionOption } from '../api/client'
import { money } from '../country/format'
import { aidStep, reasonText } from './core'
import { nameOf, type Names } from './names'
import { Icon } from '../ui/Icon'

/**
 * Header of one action block: icon, title, price, and why it is blocked.
 * The icon is the file /public/icons/<id>.svg; while it is missing the
 * engine's emoji from the rules yaml stands in.
 *
 * Aid has action cost 0 (no overhead), yet every step sends real money from
 * the budget — so «бесплатно» would be a lie; the header names the step.
 */
export function ActionHeader({ option, id }: { option: ActionOption; id: string }) {
  // The playtest asked for the bomb to read as locked until the tech is
  // bought (#16): the padlock stands in the header while the action is
  // unavailable for the lack of nuclear technology.
  const locked = !option.available && option.reason === 'requires_nuclear_tech'
  return (
    <div className="row action-head">
      <span>
        {locked && <Icon name="lock" size={16} />} <Icon name={id} fallback={option.ui.emoji} />{' '}
        {option.ui.title}
      </span>
      <span className="muted">
        {option.available
          ? option.min_amount != null
            ? `по ${money(aidStep(option))} за шаг`
            : option.cost > 0
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
 * Numeric field for a single count: a thumb-sized − / + around the number,
 * exactly like TargetCounters («инвестировать в города»): buttons only — no
 * typing, no native spin arrows, no on-screen keyboard on phones.
 * `max == null` means the rules set no per-round limit. `step` widens the
 * buttons to money-sized moves (помощь идёт пятидесятками), and
 * `format` restyles the readout («50 $» instead of «50»).
 */
export function NumberStepper({
  label,
  noun,
  value,
  max,
  onChange,
  disabled,
  step = 1,
  format,
}: {
  /** Accessible label of the readout itself («Сколько бомб»). */
  label: string
  /** Accusative noun for the ± buttons («бомбу») — kept separate so label
   *  queries (getByLabelText) match only the readout. */
  noun: string
  value: number
  max: number | null
  onChange: (next: number) => void
  disabled?: boolean
  /** How much one click adds or removes. */
  step?: number
  /** Renders the readout; the default prints the raw number. */
  format?: (value: number) => string
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
        onClick={() => onChange(clamp(value - step))}
      >
        −
      </button>
      <output aria-label={label}>{format ? format(value) : value}</output>
      <button
        type="button"
        className="ghost"
        aria-label={`Добавить ${noun}`}
        disabled={disabled || (max != null && value >= max)}
        onClick={() => onChange(clamp(value + step))}
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

/**
 * Aid: an amount per recipient, moved by the same thumb-sized − / + as every
 * other order — no typing, no on-screen keyboard on phones. One click moves
 * `aidStep(option)` dollars; `+` stops at what the budget still has, so
 * the draft can never go into the red through aid alone.
 */
export function AidFields({
  option,
  names,
  aid,
  onChange,
  disabled,
  budgetLeft,
}: {
  option: ActionOption
  names: Names
  aid: Record<string, number>
  onChange: (next: Record<string, number>) => void
  disabled?: boolean
  /** Budget not yet committed by the whole draft. */
  budgetLeft: number
}) {
  const set = (id: string, amount: number) => {
    const next = { ...aid }
    if (amount <= 0) delete next[id]
    else next[id] = amount
    onChange(next)
  }
  const step = aidStep(option)

  return (
    <>
      <ul className="targets">
        {(option.targets ?? []).map((id) => {
          const current = aid[id] ?? 0
          const title = nameOf(names, id)
          return (
            <li key={id} className="row">
              <span>{title}</span>
              <NumberStepper
                label={`Сумма помощи ${title}`}
                noun={`помощь ${title}`}
                value={current}
                max={budgetLeft + current}
                step={step}
                format={money}
                disabled={disabled}
                onChange={(next) => set(id, next)}
              />
            </li>
          )
        })}
      </ul>
      {/* The step is the amount itself: players read «бесплатно» in the header
          and then see 50 $ leave the budget — spell the mechanics out. */}
      <p className="muted aid-hint">
        Это не комиссия: каждый шаг — {money(step)} помощи. Сумма спишется с вашего бюджета и придёт
        стране-получателю после подведения итогов.
      </p>
    </>
  )
}
