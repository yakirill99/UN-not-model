import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { gameInfo, hostStatus } from '../test/host'
import { gameLog, playedLog } from '../test/log'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import HostPage from './HostPage'

vi.mock('../api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const GET = vi.mocked(api.GET)

/** The page fires info, round status and the log in parallel — answer by path. */
function answer(
  responses: { game?: unknown; status?: unknown; log?: unknown; gameError?: unknown } = {},
) {
  GET.mockImplementation((path: string) => {
    if (path.endsWith('/round')) {
      return Promise.resolve({ data: responses.status ?? hostStatus() }) as never
    }
    if (path.endsWith('/log')) {
      return Promise.resolve({ data: responses.log ?? gameLog() }) as never
    }
    return Promise.resolve({
      data: responses.gameError ? undefined : (responses.game ?? gameInfo()),
      error: responses.gameError,
    }) as never
  })
}

function renderPage(at = '/host/g1') {
  return renderWithSession(<Route path="/host/:gameId" element={<HostPage />} />, {
    at,
    session: fakeSession({ principal: HOST }),
  })
}

describe('HostPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the game and the round status together', async () => {
    answer()
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Демо-партия' })).toBeTruthy()
    const paths = GET.mock.calls.map((c) => c[0])
    expect(paths).toContain('/api/games/{game_id}')
    expect(paths).toContain('/api/games/{game_id}/round')
    expect(paths).toContain('/api/games/{game_id}/log')
  })

  it('shows the scenario, the codes and the resolve button on one screen', async () => {
    answer()
    renderPage()
    expect(await screen.findByText(/smolny, правила 1.0.0/)).toBeTruthy()
    expect(screen.getByText('RUS-L75WVG')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Подвести итоги раунда 1' })).toBeTruthy()
  })

  it('falls back to a generic title for an untitled game', async () => {
    answer({ game: gameInfo({ title: '' }) })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
  })

  it('keeps the codes readable when the round status is missing', async () => {
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/round')) {
        return Promise.resolve({ data: undefined, error: { detail: 'no round yet' } }) as never
      }
      return Promise.resolve({ data: gameInfo() }) as never
    })
    renderPage()
    expect(await screen.findByText('RUS-L75WVG')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
  })

  it('reloads both requests on demand', async () => {
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(3))
  })

  it('disables the refresh button while a reload is in flight', async () => {
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })

    let resolve!: (v: unknown) => void
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/round')) return Promise.resolve({ data: hostStatus() }) as never
      if (path.endsWith('/log')) return Promise.resolve({ data: gameLog() }) as never
      return new Promise((r) => (resolve = r)) as never
    })
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(screen.getByRole('button', { name: 'Обновляем…' })).toHaveProperty('disabled', true)

    resolve({ data: gameInfo() })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy())
  })

  it('refreshes the panel after the round is resolved', async () => {
    answer()
    vi.mocked(api.POST).mockResolvedValue({
      data: { round: 1, events: 5, next_round: 2, finished: false, standings: [] },
    } as never)
    renderPage()
    await screen.findByRole('button', { name: 'Подвести итоги раунда 1' })
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 1' }))
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(3))
  })

  it('reports a failed load and shows only the header', async () => {
    answer({ gameError: { detail: 'game not found' } })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('game not found')
    expect(screen.getByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
    expect(screen.queryByText('RUS-L75WVG')).toBeNull()
  })

  it('clears the error once a reload succeeds', async () => {
    answer({ gameError: { detail: 'boom' } })
    const { unmount } = renderPage()
    await screen.findByRole('alert')

    unmount()
    answer()
    renderPage()
    await screen.findByRole('heading', { name: 'Демо-партия' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not call the API without a game id', () => {
    answer()
    renderWithSession(<Route path="/" element={<HostPage />} />, {
      session: fakeSession({ principal: HOST }),
    })
    expect(GET).not.toHaveBeenCalled()
  })
})

describe('HostPage · the screen for the room', () => {
  beforeEach(() => vi.resetAllMocks())

  it('keeps the dashboard closed until the host asks for it', async () => {
    answer({ log: playedLog() })
    renderPage()
    await screen.findByRole('button', { name: 'Экран для зала' })
    expect(screen.queryByRole('heading', { name: 'Уровень жизни стран' })).toBeNull()
  })

  it('opens and closes the dashboard', async () => {
    answer({ log: playedLog() })
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Экран для зала' }))
    expect(screen.getByRole('heading', { name: 'Уровень жизни стран' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Экология мира' })).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Скрыть экран' }))
    expect(screen.queryByRole('heading', { name: 'Уровень жизни стран' })).toBeNull()
  })

  it('still shows the codes when the log cannot be loaded', async () => {
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/log')) {
        return Promise.resolve({ data: undefined, error: { detail: 'no log' } }) as never
      }
      if (path.endsWith('/round')) return Promise.resolve({ data: hostStatus() }) as never
      return Promise.resolve({ data: gameInfo() }) as never
    })
    renderPage()
    expect(await screen.findByText('RUS-L75WVG')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Экран для зала' }))
    expect(screen.queryByRole('heading', { name: 'Уровень жизни стран' })).toBeNull()
  })
})
