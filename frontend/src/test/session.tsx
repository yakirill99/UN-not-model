/**
 * Test helpers: render a page inside a fake session and an in-memory router.
 * Extra routes print their own path so a redirect is visible as text.
 */
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { vi } from 'vitest'
import type { Principal } from '../api/client'
import { SessionContext, type SessionState } from '../session-core'
import WhereAmI from './WhereAmI'

export const HOST: Principal = { game_id: 'g1', role: 'host', country_id: null }
export const PLAYER: Principal = { game_id: 'g1', role: 'player', country_id: 'russia' }

export function fakeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    principal: null,
    join: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

export function renderWithSession(
  routes: ReactNode,
  { at = '/', session = fakeSession() }: { at?: string; session?: SessionState } = {},
) {
  const utils = render(
    <SessionContext value={session}>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          {routes}
          <Route path="*" element={<WhereAmI />} />
        </Routes>
      </MemoryRouter>
    </SessionContext>,
  )
  return { ...utils, session }
}
