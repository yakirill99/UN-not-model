import type { Schemas } from '../api/client'
import { money, percent } from './format'

export type AnyEvent = NonNullable<Schemas['Observation']['news']>[number]

/**
 * Round events, in the player's words. The engine already filtered out what this
 * country may not see (a nuclear strike arrives without its actor, for instance),
 * so everything here is safe to render as is.
 */
export function describeEvent(event: AnyEvent): string {
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
        ? `Помощь ${money(event.amount)}: ${event.actor} → ${event.target}`
        : `Получена помощь ${money(event.amount)}`
    case 'tech_developed':
      return `Освоена технология: ${event.tech}`
    case 'shield_built':
      return `Построен щит над городом ${event.target}`
    case 'bombs_produced':
      return `Произведено бомб: ${event.count} (всего в работе ${event.bombs_pending_after})`
    case 'nuclear_strike':
      return describeStrike(event)
    case 'city_destroyed':
      return `Город ${event.target} разрушен (${event.cause})`
    case 'sanction_applied':
      return `Санкции против ${event.target}: развитие −${event.delta}`
    case 'laugh_awarded':
      return `Приз за юмор: ${event.target}, +${event.bonus} (итого ${event.laugh_after})`
    case 'round_ended':
      return `Раунд завершён. Бюджет ${money(event.budget_after)}, бомб освобождено ${event.bombs_released}, помощь ${money(event.aid_credited)}`
  }
}

/** The actor is absent when the engine hid it from this player — do not invent one. */
function describeStrike(event: Extract<AnyEvent, { type: 'nuclear_strike' }>): string {
  const who = event.actor ? `${event.actor} нанёс` : 'Нанесён'
  const outcome = {
    absorbed: 'щит поглотил удар',
    destroyed: 'город разрушен',
    already_destroyed: 'город уже был разрушен',
  }[event.outcome]
  return `${who} ядерный удар по ${event.target}: ${outcome}`
}
