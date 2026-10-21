import { Navigate, Outlet, useParams } from 'react-router'
import { homeOf, useSession } from '../session-core'

/**
 * Route guard: no session -> join page; a session for another game or another role
 * -> that principal's own home. Children render only when the URL matches the cookie.
 */
export default function RequireRole({ role }: { role: 'host' | 'player' }) {
  const { principal } = useSession()
  const { gameId } = useParams()
  if (principal === undefined) return <p className="app muted">Проверяем сессию…</p>
  if (principal === null) return <Navigate to="/" replace />
  if (principal.game_id !== gameId || principal.role !== role) {
    return <Navigate to={homeOf(principal)} replace />
  }
  return <Outlet />
}
