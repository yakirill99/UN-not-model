import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { actionSpace, roundStatus } from '../test/actions'
import { foreign, me, observation, ownCity } from '../test/observation'
import { fakeSession, PLAYER, renderWithSession } from '../test/session'
import PlayPage from './PlayPage'

vi.mock('../api/client', () => ({
  api: { GET: vi.fn(), PUT: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
  orderErrors: () => [],
}))
const GET = vi.mocked(api.GET)

const OBS = observation({
  me: me({ cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург' })] }),
  others: [foreign()],
})

/** The page fires observation, action-space and round in parallel — answer by path. */
function answer(responses: {
  observation?: unknown
  space?: unknown
  round?: unknown
  observationError?: unknown
}) {
  GET.mockImplementation((path: string) => {
    if (path.endsWith('/observation')) {
      return Promise.resolve({
        data: responses.observationError ? undefined : (responses.observation ?? OBS),
        error: responses.observationError,
      }) as never
    }
    if (path.endsWith('/action-space')) {
      return Promise.resolve({ data: responses.space ?? actionSpace() }) as never
    }
    return Promise.resolve({ data: responses.round ?? roundStatus() }) as never
  })
}

function renderPage(at = '/play/g1') {
  return renderWithSession(<Route path="/play/:gameId" element={<PlayPage />} />, {
    at,
    session: fakeSession({ principal: PLAYER }),
  })
}

describe('PlayPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the country, the action space and the round in one go', async () => {
    answer({})
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Россия' })).toBeTruthy()
    const paths = GET.mock.calls.map((c) => c[0])
    expect(paths).toContain('/api/games/{game_id}/observation')
    expect(paths).toContain('/api/games/{game_id}/action-space')
    expect(paths).toContain('/api/games/{game_id}/round')
    expect(screen.getByText('Раунд 2')).toBeTruthy()
  })

  it('shows the card and the order form together', async () => {
    answer({})
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Приказы на раунд 1' })).toBeTruthy()
    expect(screen.getAllByText('Москва').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Отправить приказы' })).toBeTruthy()
  })

  it('hides the form and explains the wait once orders are closed', async () => {
    answer({ round: roundStatus({ phase: 'resolving' }) })
    renderPage()
    expect(await screen.findByText(/Приказы закрыты \(resolving\)/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Отправить приказы' })).toBeNull()
  })

  it('says orders are unavailable when the round status itself is missing', async () => {
    answer({ round: undefined })
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/observation')) return Promise.resolve({ data: OBS }) as never
      if (path.endsWith('/action-space')) return Promise.resolve({ data: actionSpace() }) as never
      return Promise.resolve({ data: undefined, error: { detail: 'nope' } }) as never
    })
    renderPage()
    expect(await screen.findByText('Приказы сейчас недоступны.')).toBeTruthy()
  })

  it('warns that a resubmission replaces the accepted orders', async () => {
    answer({ round: roundStatus({ submitted: { russia: true } }) })
    renderPage()
    expect(await screen.findByText(/Приказы на этот раунд уже приняты/)).toBeTruthy()
  })

  it.each([
    [100, 'ok'],
    [50, 'warn'],
    [20, 'bad'],
  ])('colours world ecology %i%% as %s', async (ecology, tone) => {
    answer({ observation: observation({ ecology, me: OBS.me, others: OBS.others }) })
    renderPage()
    const value = await screen.findByText(`${ecology} %`)
    expect(value.className).toBe(tone)
  })

  it('reloads everything on demand', async () => {
    answer({})
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(3))
  })

  it('disables the refresh button while a reload is in flight', async () => {
    answer({})
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })

    let resolve!: (v: unknown) => void
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/observation')) return new Promise((r) => (resolve = r)) as never
      if (path.endsWith('/round')) return Promise.resolve({ data: roundStatus() }) as never
      return Promise.resolve({ data: actionSpace() }) as never
    })
    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(screen.getByRole('button', { name: 'Обновляем…' })).toHaveProperty('disabled', true)

    resolve({ data: OBS })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy())
  })

  it('reports a failed observation and keeps the page usable', async () => {
    answer({ observationError: { detail: 'round is being resolved' } })
    renderPage()
    expect((await screen.findByRole('alert')).textContent).toBe('round is being resolved')
    expect(screen.getByRole('heading', { name: 'Моя страна' })).toBeTruthy()
  })

  it('clears the error once a reload succeeds', async () => {
    answer({ observationError: { detail: 'boom' } })
    const { unmount } = renderPage()
    await screen.findByRole('alert')

    // Without data there is no refresh button, so the player retries by reopening.
    unmount()
    answer({})
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('does not call the API without a game id', () => {
    answer({})
    renderWithSession(<Route path="/" element={<PlayPage />} />, {
      session: fakeSession({ principal: PLAYER }),
    })
    expect(GET).not.toHaveBeenCalled()
  })

  it('reloads the card after the form reports a successful submission', async () => {
    answer({})
    vi.mocked(api.PUT).mockResolvedValue({ error: undefined } as never)
    renderPage()
    await screen.findByRole('button', { name: 'Отправить приказы' })

    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    GET.mockClear()
    await userEvent.click(screen.getByRole('button', { name: 'Отправить приказы' }))

    expect(api.PUT).toHaveBeenCalledOnce()
    await waitFor(() => expect(GET).toHaveBeenCalledTimes(3))
  })

  it('keeps the card alive when the action space is gone between rounds', async () => {
    GET.mockImplementation((path: string) => {
      if (path.endsWith('/observation')) return Promise.resolve({ data: OBS }) as never
      if (path.endsWith('/action-space'))
        return Promise.resolve({ data: undefined, error: { detail: 'resolving' } }) as never
      return Promise.resolve({ data: roundStatus() }) as never
    })
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Россия' })).toBeTruthy()
    expect(screen.getByText('Приказы сейчас недоступны.')).toBeTruthy()
  })

  it('survives an observation whose news list is absent', async () => {
    const obs = observation({ me: OBS.me, others: OBS.others })
    delete (obs as { news?: unknown }).news
    answer({ observation: obs })
    renderPage()
    expect(await screen.findByText('Пока ничего не произошло.')).toBeTruthy()
  })
})
