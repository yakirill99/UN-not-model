/**
 * The order draft and the arithmetic around it.
 *
 * The draft mirrors `CountryOrders` one to one, so submitting is a plain PUT of
 * the draft. Costs repeat the backend's budget check (engine/actions.py: validate)
 * so the player sees the total before the server recomputes it — the server stays
 * the authority, this is only a preview.
 */
import type { ActionOption, ActionSpace, CountryOrders } from '../api/client'

export type Draft = {
  invest: string[]
  eco_programs: number
  nuclear_tech: boolean
  bombs: number
  strikes: string[]
  shields: string[]
  sanctions: string[]
  aid: Record<string, number>
}

export function emptyDraft(): Draft {
  return {
    invest: [],
    eco_programs: 0,
    nuclear_tech: false,
    bombs: 0,
    strikes: [],
    shields: [],
    sanctions: [],
    aid: {},
  }
}

export function isEmpty(draft: Draft): boolean {
  return (
    draft.invest.length === 0 &&
    draft.eco_programs === 0 &&
    !draft.nuclear_tech &&
    draft.bombs === 0 &&
    draft.strikes.length === 0 &&
    draft.shields.length === 0 &&
    draft.sanctions.length === 0 &&
    Object.keys(draft.aid).length === 0
  )
}

/** A draft is a CountryOrders already; the cast documents that, nothing is reshaped. */
export function toBody(draft: Draft): CountryOrders {
  return draft
}

export function costOf(space: ActionSpace, id: string): number {
  return space.actions[id]?.cost ?? 0
}

/** Same sum the backend checks against the budget: strikes and sanctions are free. */
export function totalCost(draft: Draft, space: ActionSpace): number {
  return (
    draft.invest.length * costOf(space, 'invest') +
    draft.eco_programs * costOf(space, 'eco_program') +
    (draft.nuclear_tech ? costOf(space, 'nuclear_tech') : 0) +
    draft.bombs * costOf(space, 'bomb') +
    draft.shields.length * costOf(space, 'shield') +
    Object.values(draft.aid).reduce((sum, amount) => sum + amount, 0)
  )
}

/** How many times `id` is already used in the draft (for max_count limits). */
export function usedCount(draft: Draft, id: string): number {
  switch (id) {
    case 'invest':
      return draft.invest.length
    case 'eco_program':
      return draft.eco_programs
    case 'nuclear_tech':
      return draft.nuclear_tech ? 1 : 0
    case 'bomb':
      return draft.bombs
    case 'strike':
      return draft.strikes.length
    case 'shield':
      return draft.shields.length
    case 'sanction':
      return draft.sanctions.length
    default:
      return Object.keys(draft.aid).length
  }
}

/** Room left under `max_count`; `null` means the rules set no limit. */
export function countLeft(option: ActionOption, used: number): number | null {
  return option.max_count == null ? null : Math.max(0, option.max_count - used)
}

/** Reasons the engine returns, in the player's language (unknown codes pass through). */
export const REASONS: Record<string, string> = {
  already_owned: 'уже есть',
  requires_nuclear_tech: 'нужна ядерная технология',
  no_bombs: 'нет готовых бомб',
  insufficient_budget: 'не хватает бюджета',
  no_targets: 'нет доступных целей',
  unsupported_by_engine: 'пока не поддерживается движком',
  invalid_target: 'недопустимая цель',
  limit_exceeded: 'превышен лимит на раунд',
  below_minimum: 'сумма меньше минимальной',
  over_budget: 'на все приказы не хватает бюджета',
  unavailable: 'недоступно',
}

export function reasonText(reason: string | null | undefined): string {
  if (!reason) return REASONS.unavailable
  return REASONS[reason] ?? reason
}
