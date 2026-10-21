/**
 * Session primitives shared by the provider and the pages (kept out of the .tsx file
 * so Vite's fast refresh sees a components-only module there).
 */
import { createContext, useContext } from 'react'
import type { Principal } from './api/client'

export type SessionState = {
  /** `undefined` while the first /me request is in flight. */
  principal: Principal | null | undefined
  join: (code: string) => Promise<Principal>
  logout: () => Promise<void>
}

export const SessionContext = createContext<SessionState | null>(null)

export class JoinError extends Error {
  status: number
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
  }
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession outside SessionProvider')
  return ctx
}

/** Where a principal belongs: the host panel or the player's screen. */
export function homeOf(p: Principal): string {
  return p.role === 'host' ? `/host/${p.game_id}` : `/play/${p.game_id}`
}
