/**
 * Units the backend speaks, rendered the way a player reads them.
 *
 * life_level and average_life_level arrive in 1/100 of a percent: 4567 is 45.67 %.
 * development and ecology are whole percent. Budget is a plain integer.
 */

/** 4567 -> "45.67 %" */
export function lifeLevel(hundredths: number): string {
  return `${(hundredths / 100).toFixed(2)} %`
}

/** 1200 -> "1 200 $" (narrow no-break space, so the number never wraps) */
export function money(amount: number): string {
  return `${amount.toLocaleString('ru-RU').replace(/\u00a0/g, '\u202f')} $`
}

/** 73 -> "73 %" */
export function percent(whole: number): string {
  return `${whole} %`
}

/** Ecology is a world-wide scale: below 40 % the planet is in trouble. */
export function ecologyTone(ecology: number): 'ok' | 'warn' | 'bad' {
  if (ecology >= 60) return 'ok'
  if (ecology >= 40) return 'warn'
  return 'bad'
}
