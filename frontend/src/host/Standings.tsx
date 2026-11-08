import type { Team } from './core'
import { allEqual } from '../country/rank'
import { Medal } from '../country/Medal'
import { lifeLevel } from '../country/format'

/**
 * Final standings of a resolved round: `[country_id, life_level]` pairs the engine
 * returns, already sorted best first. Names come from the host's team list, and
 * the top three get medals so the projector reads at a glance. A completely
 * level field (nothing resolved yet) earns no medals at all.
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
  const unranked = allEqual(standings.map(([, level]) => level))

  return (
    <table className="codes">
      <tbody>
        {standings.map(([id, level], place) => (
          <tr key={id}>
            <td className="muted">
              {/* No literal whitespace in JSX here: the textContent of the cell
                  must read «1США60.00 %», the gap is CSS (see .codes .icon). */}
              {!unranked && <Medal place={place + 1} size={16} />}
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
