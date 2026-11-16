import type { Team } from './core'
import { Icon } from '../ui/Icon'

/**
 * The host's table: a code to read out loud, whether the team joined, whether its
 * orders are in. Codes of bots are intentionally absent — nobody logs in as a bot.
 *
 * The host pick is one action for both rules versions: «Приз за юмор» in v1,
 * «Харизма раунда» (+stability) in v2 — the label follows the game's rules.
 */
export default function TeamTable({
  list,
  onLaugh,
  busy,
  pickLabel,
}: {
  list: Team[]
  onLaugh: (countryId: string | null) => void
  busy: boolean
  pickLabel: string
}) {
  return (
    <table className="codes">
      <tbody>
        {list.map((team) => (
          <tr key={team.id}>
            <td>
              {team.name}
              {team.laughWinner && (
                <span title={pickLabel}>
                  {' '}
                  <Icon name="laugh" size={16} />
                </span>
              )}
            </td>
            <td>
              {team.isBot ? (
                <span className="muted">бот</span>
              ) : (
                <code className="code">{team.code}</code>
              )}
            </td>
            <td className="muted">{statusText(team)}</td>
            <td>
              {!team.isBot && (
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => onLaugh(team.laughWinner ? null : team.id)}
                >
                  {team.laughWinner ? 'Снять' : pickLabel}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Bots need no status: the engine submits for them during resolution. */
function statusText(team: Team): string {
  if (team.isBot) return ''
  if (!team.joined) return 'ещё не вошли'
  return team.submitted ? 'приказы приняты' : 'приказы не отправлены'
}
