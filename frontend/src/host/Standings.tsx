import type { Team } from './core'
import { medalFor } from '../country/rank'
import { lifeLevel } from '../country/format'

/**
 * Final standings of a resolved round: `[country_id, life_level]` pairs the engine
 * returns, already sorted best first. Names come from the host's team list, and
 * the top three get medals so the projector reads at a glance.
 */
export default function Standings({
  standings,
  list,
}: {
  standings: [string, number][]
  list: Team[]
}) {
  if (standings.length === 0) return null
  const nameOf = (id: string) => list.find((t) => t.id === id)?.name ?? id

  return (
    <table className="codes">
      <tbody>
        {standings.map(([id, level], place) => (
          <tr key={id}>
            <td className="muted">
              {medalFor(place + 1) && `${medalFor(place + 1)} `}
              {place + 1}
            </td>
            <td>{nameOf(id)}</td>
            <td>{lifeLevel(level)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
