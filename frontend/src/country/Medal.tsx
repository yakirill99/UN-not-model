import { Icon } from '../ui/Icon'

/** Gold, silver or bronze for places 1–3; any other place earns nothing. */
export function Medal({ place, size = 18 }: { place: number; size?: number }) {
  if (place < 1 || place > 3) return null
  return <Icon name={`medal-${place}`} size={size} label={`${place} место`} />
}
