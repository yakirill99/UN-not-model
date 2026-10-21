import { screen } from '@testing-library/react'
import { Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { Principal } from '../api/client'
import { fakeSession, HOST, PLAYER, renderWithSession } from '../test/session'
import RequireRole from './RequireRole'

function renderGuarded(at: string, principal: Principal | null | undefined) {
  return renderWithSession(
    <>
      <Route element={<RequireRole role="host" />}>
        <Route path="/host/:gameId" element={<p>HOST PANEL</p>} />
      </Route>
      <Route element={<RequireRole role="player" />}>
        <Route path="/play/:gameId" element={<p>PLAYER SCREEN</p>} />
      </Route>
    </>,
    { at, session: fakeSession({ principal }) },
  )
}

const location = () => screen.getByTestId('location').textContent

describe('RequireRole', () => {
  it('shows a placeholder while the session is being checked', () => {
    renderGuarded('/host/g1', undefined)
    expect(screen.getByText('Проверяем сессию…')).toBeTruthy()
  })

  it('no session -> join page', () => {
    renderGuarded('/host/g1', null)
    expect(location()).toBe('/')
  })

  it('lets the host into their own game', () => {
    renderGuarded('/host/g1', HOST)
    expect(screen.getByText('HOST PANEL')).toBeTruthy()
  })

  it('lets a player into their own game', () => {
    renderGuarded('/play/g1', PLAYER)
    expect(screen.getByText('PLAYER SCREEN')).toBeTruthy()
  })

  it('a player on /host is sent to /play', () => {
    renderGuarded('/host/g1', PLAYER)
    expect(screen.getByText('PLAYER SCREEN')).toBeTruthy()
  })

  it('the host on /play is sent to /host', () => {
    renderGuarded('/play/g1', HOST)
    expect(screen.getByText('HOST PANEL')).toBeTruthy()
  })

  it('a session for another game is sent to its own game', () => {
    renderGuarded('/host/other-game', HOST)
    expect(screen.getByText('HOST PANEL')).toBeTruthy()
  })
})
