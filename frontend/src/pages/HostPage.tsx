import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api, type GameInfo } from '../api/client'
import Header from './Header'

/** Host home. The real panel (codes, submissions, resolve) is sprint 5, task #60. */
export default function HostPage() {
  const { gameId } = useParams()
  const [game, setGame] = useState<GameInfo | null>(null)

  useEffect(() => {
    if (!gameId) return
    api
      .GET('/api/games/{game_id}', { params: { path: { game_id: gameId } } })
      .then(({ data }) => setGame(data ?? null))
  }, [gameId])

  return (
    <main className="app">
      <Header title={game?.title || 'Панель ведущего'} subtitle="Ведущий" />
      {game && (
        <section className="card stack">
          <p>
            Раунд {game.current_round} из {game.rounds_total} · {game.scenario_id}, правила{' '}
            {game.rules_version}
          </p>
          <table className="codes">
            <tbody>
              {game.players.map((p) => (
                <tr key={p.country_id}>
                  <td>{p.name}</td>
                  <td>
                    {p.kind === 'bot' ? (
                      <span className="muted">бот</span>
                    ) : (
                      <code className="code">{p.join_code}</code>
                    )}
                  </td>
                  <td className="muted">
                    {p.kind === 'bot' ? '' : p.joined ? 'вошли' : 'ещё не вошли'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}
