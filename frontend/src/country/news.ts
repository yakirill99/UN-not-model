import type { Schemas } from '../api/client'
import { money, percent } from './format'
import { plural, times, type Group } from './merge'
import { nameOf, type Names } from './names'

export type AnyEvent = NonNullable<Schemas['Observation']['news']>[number]

/**
 * Round events, in the player's words. The engine already filtered out what this
 * country may not see (a nuclear strike arrives without its actor, for instance),
 * so everything here is safe to render as is.
 *
 * Events carry raw ids (`spb`, `usa`); `names` translates them into the words
 * players read («Санкт-Петербург», «США»). Without the dictionary the ids are
 * shown as is — the tests rely on that, and a missing translation must not
 * hide a fact. The author of sanctions is always spelled out for the victim:
 * «кто наложил на тебя» — was the playtest's ask (#6).
 */
export function describeEvent(event: AnyEvent, names: Names = {}): string {
  switch (event.type) {
    case 'order_rejected':
      return `Приказ «${event.action}» отклонён: ${event.reason}`
    case 'budget_spent':
      return `Потрачено ${money(event.amount)} на «${event.action}», осталось ${money(event.budget_after)}`
    case 'city_invested':
      return `Развитие города выросло с ${percent(event.development_before)} до ${percent(event.development_after)}`
    case 'ecology_changed':
      return `Экология ${event.delta >= 0 ? '+' : ''}${event.delta} → ${percent(event.ecology_after)} (${event.cause})`
    case 'life_level_computed':
      return `Пересчитан уровень жизни: ${(event.life_level / 100).toFixed(2)} %`
    case 'income_credited':
      return `Доход ${money(event.amount)}, бюджет ${money(event.budget_after)}`
    case 'aid_transferred':
      return event.actor
        ? `Помощь ${money(event.amount)}: ${nameOf(names, event.actor)} → ${nameOf(names, event.target)}`
        : `Получена помощь ${money(event.amount)}`
    case 'tech_developed':
      return `Освоена технология: ${event.tech}`
    case 'shield_built':
      return `Построен щит над городом ${nameOf(names, event.target)}`
    case 'bombs_produced':
      return `Произведено бомб: ${event.count} (всего в работе ${event.bombs_pending_after})`
    case 'nuclear_strike':
      return describeStrike(event, names)
    case 'city_destroyed':
      return `Город ${nameOf(names, event.target)} разрушен (${event.cause})`
    case 'sanction_applied': {
      // The victim always learns who hit them (section 11); the actor key may
      // still be missing in tests and replays — then the old impersonal line.
      // The arrow avoids Russian genitive forms («против Ирана»), which the
      // scenario names would need case by case.
      const from = event.actor ? ` от ${nameOf(names, event.actor)} →` : ' против'
      return `Санкции${from} ${nameOf(names, event.target)}: развитие −${event.delta}`
    }
    case 'laugh_awarded':
      return `Приз за юмор: ${nameOf(names, event.target)}, +${event.bonus} (итого ${event.laugh_after})`
    case 'charisma_awarded':
      return `Харизма раунда: ${nameOf(names, event.target)}, +${event.bonus} к устойчивости (итого ${event.stability_after})`
    case 'stability_changed': {
      // The расшифровка is the point (GAME_RULES_2.md 17): «почему упала устойчивость».
      const parts: string[] = []
      if (event.dynamics) parts.push(`динамика ${signed(event.dynamics)}`)
      if (event.level_effect) parts.push(`уровень жизни ${signed(event.level_effect)}`)
      if (event.shocks) parts.push(`потрясения ${signed(event.shocks)}`)
      if (event.actions) parts.push(`действия ${signed(event.actions)}`)
      const why = parts.length > 0 ? ` (${parts.join(', ')})` : ''
      return `Устойчивость ${nameOf(names, event.target)}: ${event.value_before} → ${event.value_after}${why}`
    }
    case 'power_changed':
      return `Смена власти в ${nameOf(names, event.target)}: бюджет урезан вдвое, устойчивость сброшена до ${event.stability_reset}`
    case 'rating_updated':
      return `Рейтинг ${nameOf(names, event.target)}: ${event.level} (${event.score} ${plural(event.score, 'балл', 'балла', 'баллов')})`
    case 'climate_threshold': {
      const where = nameOf(names, event.target)
      if (event.level === 'unstable')
        return `Климатическая нестабильность: ${where} теряет ${Math.abs(event.development_delta)} п.п. развития`
      if (event.level === 'collapse')
        return `Экологический коллапс: частный капитал исчез, устойчивость всех стран ${signed(event.stability_delta)}`
      return `Климатическая катастрофа: устойчивость всех стран ${signed(event.stability_delta)}, доходы -20 %`
    }
    case 'private_investments_credited':
      return `Частные инвестиции: +${money(event.amount)}, бюджет ${money(event.budget_after)}`
    case 'round_ended':
      return `Раунд завершён. Бюджет ${money(event.budget_after)}, бомб освобождено ${event.bombs_released}, помощь ${money(event.aid_credited)}`
  }
}

/** −5 stays «−5», +3 becomes «+3»: the deltas of the v2 formulas read with their sign. */
function signed(n: number): string {
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** The actor is absent when the engine hid it from this player — do not invent one. */
function describeStrike(
  event: Extract<AnyEvent, { type: 'nuclear_strike' }>,
  names: Names,
): string {
  const who = event.actor ? `${nameOf(names, event.actor)} нанёс` : 'Нанесён'
  const outcome = {
    absorbed: 'щит поглотил удар',
    destroyed: 'город разрушен',
    already_destroyed: 'город уже был разрушен',
  }[event.outcome]
  return `${who} ядерный удар по ${nameOf(names, event.target)}: ${outcome}`
}

/**
 * One merged story in the player's words. A single event reads exactly as
 * before (describeEvent); a group folds into one line with the summed effect —
 * «складывай одинаковые эффекты новости».
 */
export function describeGroup(group: Group, names: Names = {}): string {
  const [first] = group.events
  if (group.events.length === 1) return describeEvent(first, names)

  switch (first.type) {
    case 'city_invested': {
      // Per-city run: first «before» → last «after» folds the whole story;
      // different cities are listed side by side, each with its own run.
      const runs = new Map<string, { before: number; after: number; n: number }>()
      for (const e of group.events as Extract<AnyEvent, { type: 'city_invested' }>[]) {
        const run = runs.get(e.target ?? '')
        if (run) {
          run.after = e.development_after
          run.n += 1
        } else {
          runs.set(e.target ?? '', {
            before: e.development_before,
            after: e.development_after,
            n: 1,
          })
        }
      }
      if (runs.size === 1) {
        const [run] = runs.values()
        return `Развитие города выросло с ${percent(run.before)} до ${percent(run.after)} (${plural(group.events.length, 'ход', 'хода', 'ходов')})`
      }
      const list = [...runs.entries()]
        .map(([id, run]) => `${nameOf(names, id)} ${percent(run.before)} → ${percent(run.after)}`)
        .join(', ')
      return `Развитие городов (${group.events.length}): ${list}`
    }
    case 'bombs_produced': {
      const count = (group.events as Extract<AnyEvent, { type: 'bombs_produced' }>[]).reduce(
        (s, e) => s + e.count,
        0,
      )
      const pending = (
        group.events[group.events.length - 1] as Extract<AnyEvent, { type: 'bombs_produced' }>
      ).bombs_pending_after
      return `Произведено бомб: ${count} (всего в работе ${pending}, ${plural(group.events.length, 'приказ', 'приказа', 'приказов')})`
    }
    case 'aid_transferred': {
      const amount = (group.events as Extract<AnyEvent, { type: 'aid_transferred' }>[]).reduce(
        (s, e) => s + e.amount,
        0,
      )
      return first.actor
        ? `Помощь ${money(amount)}: ${nameOf(names, first.actor)} → ${nameOf(names, first.target)} (${plural(group.events.length, 'платёж', 'платежа', 'платежей')})`
        : `Получена помощь ${money(amount)} (${plural(group.events.length, 'платёж', 'платежа', 'платежей')})`
    }
    case 'sanction_applied': {
      const delta = (group.events as Extract<AnyEvent, { type: 'sanction_applied' }>[]).reduce(
        (s, e) => s + e.delta,
        0,
      )
      const from = first.actor ? ` от ${nameOf(names, first.actor)} →` : ' против'
      return `Санкции${from} ${nameOf(names, first.target)}: развитие −${delta} (${plural(group.events.length, 'санкция', 'санкции', 'санкций')})`
    }
    case 'ecology_changed': {
      const delta = (group.events as Extract<AnyEvent, { type: 'ecology_changed' }>[]).reduce(
        (s, e) => s + e.delta,
        0,
      )
      const after = (
        group.events[group.events.length - 1] as Extract<AnyEvent, { type: 'ecology_changed' }>
      ).ecology_after
      return `Экология ${delta >= 0 ? '+' : ''}${delta} → ${percent(after)} (${first.cause}, ${plural(group.events.length, 'событие', 'события', 'событий')})`
    }
    case 'shield_built': {
      const cities = [
        ...new Set(
          (group.events as Extract<AnyEvent, { type: 'shield_built' }>[]).map((e) =>
            nameOf(names, e.target),
          ),
        ),
      ]
      return `Построены щиты над городами: ${cities.join(', ')} (${cities.length})`
    }
    case 'nuclear_strike':
      return `${describeStrike(first, names)}${times(group.events.length)}`
    default:
      // Not a mergeable story (see merge.ts): the first line stands for all.
      return `${describeEvent(first, names)}${times(group.events.length)}`
  }
}
