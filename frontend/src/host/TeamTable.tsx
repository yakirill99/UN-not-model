import type { Team } from './core'

/**
 * The host's table: a code to read out loud, whether the team joined, whether its
 * orders are in. Codes of bots are intentionally absent — nobody logs in as a bot.
 */
export default function TeamTable({
  list,
  onLaugh,
  busy,
}: {
  list: Team[]
  onLaugh: (countryId: string | null) => void
  busy: boolean
}) {
  return (
    <table className="codes">
      <tbody>
        {list.map((team) => (
          <tr key={team.id}>
            <td>
              {team.name}
              {team.laughWinner && <span title="Приз за юмор"> 😄</span>}
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
                  {team.laughWinner ? 'Снять приз' : 'Приз за юмор'}
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
