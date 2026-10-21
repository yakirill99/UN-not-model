import { screen } from '@testing-library/react'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { fakeSession, PLAYER, renderWithSession } from '../test/session'
import PlayPage from './PlayPage'

vi.mock('../api/client', () => ({ api: { GET: vi.fn() } }))
const GET = vi.mocked(api.GET)

const OBS = {
  round: 2,
  ecology: 80,
  me: {
    id: 'russia',
    name: 'Россия',
    budget: 1200,
    average_life_level: 4567,
    cities: [],
    nuclear_tech: false,
    bombs: 0,
    bombs_pending: 0,
    laugh: 0,
    aid_pending: 0,
    sanctioned_by: [],
  },
  others: [],
  news: [],
}

describe('PlayPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('shows country name, round, budget and life level (1/100 %)', async () => {
    GET.mockResolvedValue({ data: OBS } as never)
    renderWithSession(<Route path="/play/:gameId" element={<PlayPage />} />, {
      at: '/play/g1',
      session: fakeSession({ principal: PLAYER }),
    })
    expect(await screen.findByRole('heading', { name: 'Россия' })).toBeTruthy()
    expect(GET).toHaveBeenCalledWith('/api/games/{game_id}/observation', {
      params: { path: { game_id: 'g1' } },
    })
    expect(screen.getByText('Раунд 2')).toBeTruthy()
    expect(screen.getByText('1200 $')).toBeTruthy()
    expect(screen.getByText('45.67 %')).toBeTruthy()
  })

  it('shows a placeholder title until the observation arrives', async () => {
    GET.mockResolvedValue({ data: undefined } as never)
    renderWithSession(<Route path="/play/:gameId" element={<PlayPage />} />, {
      at: '/play/g1',
      session: fakeSession({ principal: PLAYER }),
    })
    await vi.waitFor(() => expect(GET).toHaveBeenCalled())
    expect(screen.getByRole('heading', { name: 'Моя страна' })).toBeTruthy()
    expect(screen.queryByText(/Бюджет/)).toBeNull()
  })

  it('does not call the API without a game id', () => {
    renderWithSession(<Route path="/" element={<PlayPage />} />, {
      session: fakeSession({ principal: PLAYER }),
    })
    expect(GET).not.toHaveBeenCalled()
  })
})
