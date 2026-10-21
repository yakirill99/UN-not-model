import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { homeOf, JoinError, useSession } from '../session-core'

const MESSAGES: Record<number, string> = {
  404: 'Такого кода нет. Проверьте, нет ли опечатки.',
  409: 'Этой страной управляет бот — у неё нет игроков.',
}

export default function JoinPage() {
  const { principal, join } = useSession()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      navigate(homeOf(await join(code)))
    } catch (err) {
      setError(
        err instanceof JoinError ? (MESSAGES[err.status] ?? err.message) : 'Сервер недоступен',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="app narrow">
      <h1>Мировая Арена</h1>
      <p className="muted">Введите код, который выдал ведущий</p>
      <form className="card stack" onSubmit={submit}>
        <label>
          Код
          <input
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="RUS-A1B2C3"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        {error && (
          <p className="bad" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy || code.trim().length < 4}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </form>
      {principal && (
        <p className="muted">
          Вы уже в игре как {principal.role === 'host' ? 'ведущий' : principal.country_id} —{' '}
          <Link to={homeOf(principal)}>вернуться</Link>
        </p>
      )}
      <p className="muted">
        Ведущий без кодов? <Link to="/new">Создать игру</Link>
      </p>
    </main>
  )
}
