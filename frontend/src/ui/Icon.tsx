import { useState, type ReactNode } from 'react'
import { iconUrl } from './icons'

/**
 * One icon from /public/icons/<name>.svg, sized in pixels.
 *
 * Without `label` the image is decorative and hidden from screen readers (the
 * surrounding text carries the meaning). With `label` it becomes an accessible
 * image — that is how medals are read («1 место»).
 *
 * `fallback` shows only while the file is missing: the round actions fall back
 * to the engine's emoji, so a future rule without artwork still reads fine.
 */
export function Icon({
  name,
  size = 20,
  label,
  fallback,
}: {
  name: string
  size?: number
  label?: string
  fallback?: ReactNode
}) {
  const [broken, setBroken] = useState(false)
  if (broken) {
    return fallback == null ? null : <span className="icon-fallback">{fallback}</span>
  }
  return (
    <img
      className="icon"
      src={iconUrl(name)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      onError={() => setBroken(true)}
    />
  )
}
