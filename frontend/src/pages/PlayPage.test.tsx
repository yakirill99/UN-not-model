import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { foreign, me, observation, ownCity } from '../test/observation'
import { fakeSession, PLAYER, renderWithSession } from '../test/session'
import PlayPage from './PlayPage'

vi.mock('../api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const GET = vi.mocked(api.GET)

function renderPage(at = '/play/g1') {
  return renderWithSession(<Route path="/play/:gameId" element={<PlayPage />} />, {
    at,
    session: fakeSession({ principal: PLAYER }),
  })
}

describe('PlayPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the observation for this game', async () => {
    GET.mockResolvedValue({ data: observation() } as never)
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Россия' })).toBeTruthy()
    expect(GET).toHaveBeenCalledWith('/api/games/{game_id}/observation', {
      params: { path: { game_id: 'g1' } },
    })
    expect(screen.getByText('Раунд 2')).toBeTruthy()
  })

  it('puts the country card, the rivals and the news on one screen', async () => {
    GET.mockResolvedValue({
      data: observation({
        me: me({ cities: [ownCity()] }),
        others: [foreign()],
        news: [
          {
            type: 'tech_developed',
            tech: 'nuclear',
            round: 2,
            schema_version: 1,
            actor: null,
            target: null,
          },
        ],
      }),
    } as never)
    renderPage()
    expect(await screen.findByText('Москва')).toBeTruthy()
    expect(screen.getByText('США')).toBeTruthy()
    expect(screen.getByText('Освоена технология: nuclear')).toBeTruthy()
  })

  it.each([
    [75, 'ok'],
    [50, 'warn'],
    [20, 'bad'],
  ])('colours world ecology %i%% as %s', async (ecology, tone) => {
    GET.mockResolvedValue({ data: observation({ ecology }) } as never)
    renderPage()
    const value = await screen.findByText(`${ecology} %`)
    expect(value.className).toBe(tone)
  })

  it('reloads on demand and disables the button while loading', async () => {
    let resolve!: (v: unknown) => void
    GET.mockReturnValueOnce({ data: observation() } as never).mockReturnValueOnce(
      new Promise((r) => (resolve = r)) as never,
    )
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(screen.getByRole('button', { name: 'Обновляем…' })).toHaveProperty('disabled', true)

    resolve({ data: observation({ round: 3 }) })
    await waitFor(() => expect(screen.getByText('Раунд 3')).toBeTruthy())
  })

  it('shows the server error and keeps the previous data', async () => {
    GET.mockResolvedValueOnce({ data: observation() } as never).mockResolvedValueOnce({
      data: undefined,
      error: { detail: 'round is being resolved' },
    } as never)
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect((await screen.findByRole('alert')).textContent).toBe('round is being resolved')
    expect(screen.getByText('Раунд 2')).toBeTruthy()
  })

  it('clears the error once a reload succeeds', async () => {
    GET.mockResolvedValueOnce({ data: observation() } as never)
      .mockResolvedValueOnce({ data: undefined, error: { detail: 'boom' } } as never)
      .mockResolvedValueOnce({ data: observation({ round: 4 }) } as never)
    renderPage()
    await screen.findByRole('heading', { name: 'Россия' })

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    expect(await screen.findByRole('alert')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.getByText('Раунд 4')).toBeTruthy()
  })

  it('shows only the header before the first observation arrives', async () => {
    GET.mockResolvedValue({ data: undefined, error: { detail: 'nope' } } as never)
    renderPage()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Моя страна' })).toBeTruthy()
    expect(screen.queryByText(/Экология мира/)).toBeNull()
  })

  it('survives an observation whose news list is absent', async () => {
    const obs = observation()
    delete (obs as { news?: unknown }).news
    GET.mockResolvedValue({ data: obs } as never)
    renderPage()
    expect(await screen.findByText('Пока ничего не произошло.')).toBeTruthy()
  })

  it('does not call the API without a game id', () => {
    renderWithSession(<Route path="/" element={<PlayPage />} />, {
      session: fakeSession({ principal: PLAYER }),
    })
    expect(GET).not.toHaveBeenCalled()
  })
})
