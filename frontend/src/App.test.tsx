import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { SessionContext } from './session-core'
import { fakeSession, HOST, PLAYER } from './test/session'

vi.mock('./api/client', () => ({
  api: { GET: vi.fn(() => new Promise(() => {})), POST: vi.fn() },
  errorMessage: () => 'x',
}))

function renderApp(at: string, principal: typeof HOST | null) {
  render(
    <SessionContext value={fakeSession({ principal })}>
      <MemoryRouter initialEntries={[at]}>
        <App />
      </MemoryRouter>
    </SessionContext>,
  )
}

describe('App routes', () => {
  it('/ is the join page', () => {
    renderApp('/', null)
    expect(screen.getByRole('heading', { name: 'Мировая Арена' })).toBeTruthy()
  })

  it('/new is game creation', () => {
    renderApp('/new', null)
    expect(screen.getByRole('heading', { name: 'Новая игра' })).toBeTruthy()
  })

  it('/host/:id is guarded and shows the host panel', () => {
    renderApp('/host/g1', HOST)
    expect(screen.getByText('Ведущий')).toBeTruthy()
  })

  it('/play/:id is guarded and shows the player screen', () => {
    renderApp('/play/g1', PLAYER)
    expect(screen.getByRole('heading', { name: 'Моя страна' })).toBeTruthy()
  })

  it('/play/:id without a session falls back to the join page', () => {
    renderApp('/play/g1', null)
    expect(screen.getByRole('heading', { name: 'Мировая Арена' })).toBeTruthy()
  })

  it('unknown paths redirect to the join page', () => {
    renderApp('/nope/at/all', null)
    expect(screen.getByRole('heading', { name: 'Мировая Арена' })).toBeTruthy()
  })
})
