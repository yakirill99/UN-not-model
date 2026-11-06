/**
 * Flags live in `frontend/public/flags/<code>.svg` — the file name is the
 * whole configuration, same trick as the icon set: drop in your own artwork
 * under the same name and the game picks it up after the next rebuild.
 *
 * A country without a file falls back to one of three generic pennants
 * (`generic-1..3.svg`), chosen deterministically from the name, so the
 * backdrop and the cards stay stable between reloads.
 */
import { geoOf } from './geo'

export function isoOf(name: string): string {
  return geoOf(name)?.iso ?? `generic-${(hash(name) % 3) + 1}`
}

export function flagUrl(name: string): string {
  return `${import.meta.env.BASE_URL}flags/${isoOf(name)}.svg`
}

/** djb2 — small, stable, good enough to pick a placeholder pennant. */
export function hash(text: string): number {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = (h * 33) ^ text.charCodeAt(i)
  }
  return Math.abs(h)
}
