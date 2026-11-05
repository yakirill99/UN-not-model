import { useState } from 'react'
import { flagUrl } from './flags'

/**
 * The flag of a nation from /public/flags/<code>.svg.
 *
 * While the file is missing the component shows a two-letter chip instead of
 * a broken image — a self-made scenario still reads fine, and a real flag is
 * one file drop away.
 */
export function Flag({ name, size = 21 }: { name: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  const height = Math.max(12, Math.round((size * 2) / 3))
  if (broken) {
    return (
      <span className="flag-fallback" style={{ width: size, height }} aria-hidden="true">
        {name.slice(0, 2).toUpperCase()}
      </span>
    )
  }
  return (
    <img
      className="icon flag"
      src={flagUrl(name)}
      width={size}
      height={height}
      alt=""
      aria-hidden="true"
      onError={() => setBroken(true)}
    />
  )
}
