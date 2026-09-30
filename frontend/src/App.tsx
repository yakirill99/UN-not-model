import { useEffect, useState } from 'react'
import { api } from './api/client'

type Health = { status: 'checking' } | { status: 'ok'; version: string } | { status: 'down' }

/** Sprint 5, task 1: the skeleton only shows that the typed client reaches the API. */
export default function App() {
  const [health, setHealth] = useState<Health>({ status: 'checking' })
  const [rules, setRules] = useState<string[]>([])

  useEffect(() => {
    api
      .GET('/healthz')
      .then(({ data }) =>
        setHealth(data ? { status: 'ok', version: data.version } : { status: 'down' }),
      )
      .catch(() => setHealth({ status: 'down' }))
    api
      .GET('/api/rules')
      .then(({ data }) => setRules(data ?? []))
      .catch(() => setRules([]))
  }, [])

  return (
    <main className="app">
      <h1>Мировая Арена</h1>
      <p className="muted">Веб-версия «Немодели ООН в Смольном»</p>
      <section className="card">
        <h2>Сервер</h2>
        {health.status === 'checking' && <p>Проверяем…</p>}
        {health.status === 'ok' && (
          <p>
            <span className="ok">●</span> API v{health.version} отвечает
          </p>
        )}
        {health.status === 'down' && (
          <p>
            <span className="bad">●</span> API недоступен — запустите <code>just dev</code>
          </p>
        )}
        {rules.length > 0 && <p className="muted">Версии правил: {rules.join(', ')}</p>}
      </section>
      <p className="muted">Вход по коду появится в следующей задаче спринта 5.</p>
    </main>
  )
}
