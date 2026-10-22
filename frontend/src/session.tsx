/**
 * Who am I in this browser: the principal behind the httpOnly session cookie.
 *
 * Loaded once from GET /api/auth/me on start; `join(code)` and `logout()` keep it in
 * sync with the server. Pages never touch the token: the cookie does the work.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, errorMessage, type Principal } from './api/client'
import { JoinError, SessionContext } from './session-core'

export function SessionProvider({ children }: { children: ReactNode }) {
  const [principal, setPrincipal] = useState<Principal | null | undefined>(undefined)

  useEffect(() => {
    api
      .GET('/api/auth/me')
      .then(({ data }) => setPrincipal(data ?? null))
      .catch(() => setPrincipal(null))
  }, [])

  const join = useCallback(async (code: string) => {
    const { data, error, response } = await api.POST('/api/auth/join', {
      body: { code: code.trim().toUpperCase() },
    })
    if (!data) throw new JoinError(response.status, errorMessage(error))
    setPrincipal(data.principal)
    return data.principal
  }, [])

  const logout = useCallback(async () => {
    await api.POST('/api/auth/logout')
    setPrincipal(null)
  }, [])

  return <SessionContext value={{ principal, join, logout }}>{children}</SessionContext>
}
