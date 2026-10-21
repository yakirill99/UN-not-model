import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { api, errorMessage, type GameInfo } from '../api/client'
import { homeOf, useSession } from '../session-core'

const COUNTRIES = ['russia', 'usa', 'france', 'iran', 'dprk'] as const
const BOTS = ['', 'random', 'economist', 'ecologist', 'aggressor', 'avenger', 'idle'] as const
const DEFAULT_BOTS: Record<string, string> = {
  dprk: 'aggressor',
  iran: 'economist',
  france: 'ecologist',
}

/** Host without codes: create a game, get the codes, become its host in one step. */
export default function NewGamePage() {
  const { join } = useSession()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [scenario, setScenario] = useState<'smolny' | 'equal'>('smolny')
  const [seed, setSeed] = useState(1)
  const [bots, setBots] = useState<Record<string, string>>(DEFAULT_BOTS)
  const [created, setCreated] = useState<GameInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { data, error: err } = await api.POST('/api/games', {
      body: {
        rules: 'v1.0',
        title,
        scenario,
        seed,
        mode: 'live',
        bots: COUNTRIES.filter((c) => bots[c]).map((c) => ({ country_id: c, bot: bots[c] })),
      },
    })
    setBusy(false)
    if (!data) return setError(errorMessage(err))
    setCreated(data)
  }

  async function enter() {
    if (!created?.host_code) return
    navigate(homeOf(await join(created.host_code)))
  }

  if (created) {
    return (
      <main className="app narrow">
        <h1>Игра создана</h1>
        <section className="card stack">
          <p>
            Код ведущего: <code className="code">{created.host_code}</code>
          </p>
          <table className="codes">
            <tbody>
              {created.players.map((p) => (
                <tr key={p.country_id}>
                  <td>{p.name}</td>
                  <td>
                    {p.kind === 'bot' ? (
                      <span className="muted">бот</span>
                    ) : (
                      <code className="code">{p.join_code}</code>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Коды видны и на панели ведущего — раздайте их командам.</p>
          <button onClick={enter}>Войти как ведущий</button>
        </section>
      </main>
    )
  }

  return (
    <main className="app narrow">
      <h1>Новая игра</h1>
      <form className="card stack" onSubmit={submit}>
        <label>
          Название
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Немодель, 30 сентября"
          />
        </label>
        <label>
          Сценарий
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as 'smolny' | 'equal')}
          >
            <option value="smolny">Смольный (как в 2026 году)</option>
            <option value="equal">Равные условия</option>
          </select>
        </label>
        <label>
          Seed (для повторяемости)
          <input
            type="number"
            min={0}
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
          />
        </label>
        <fieldset className="stack">
          <legend>Кто играет за страну</legend>
          {COUNTRIES.map((c) => (
            <label key={c} className="row">
              <span>{c}</span>
              <select
                value={bots[c] ?? ''}
                onChange={(e) => setBots({ ...bots, [c]: e.target.value })}
              >
                {BOTS.map((b) => (
                  <option key={b} value={b}>
                    {b === '' ? 'люди' : `бот: ${b}`}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="bad" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Создаём…' : 'Создать'}
        </button>
      </form>
      <p className="muted">
        <Link to="/">Назад ко входу по коду</Link>
      </p>
    </main>
  )
}
