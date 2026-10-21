import { screen } from '@testing-library/react'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type GameInfo } from '../api/client'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import HostPage from './HostPage'

vi.mock('../api/client', () => ({ api: { GET: vi.fn() } }))
const GET = vi.mocked(api.GET)

const GAME: GameInfo = {
  id: 'g1',
  title: 'Демо-партия',
  current_round: 1,
  rounds_total: 6,
  scenario_id: 'smolny',
  rules_version: '1.0.0',
  mode: 'live',
  phase: 'orders',
  status: 'active',
  seed: 1,
  host_code: 'HOST-DZRS3A',
  players: [
    { country_id: 'russia', name: 'Россия', kind: 'human', join_code: 'RUS-L75WVG', joined: true },
    { country_id: 'usa', name: 'США', kind: 'human', join_code: 'USA-N4FTJ7', joined: false },
    { country_id: 'dprk', name: 'КНДР', kind: 'bot', join_code: 'DPR-D3WS38', joined: false },
  ],
}

function renderAt(at: string) {
  renderWithSession(<Route path="/host/:gameId" element={<HostPage />} />, {
    at,
    session: fakeSession({ principal: HOST }),
  })
}

describe('HostPage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('loads the game and lists player codes, hiding bot codes', async () => {
    GET.mockResolvedValue({ data: GAME } as never)
    renderAt('/host/g1')

    expect(await screen.findByRole('heading', { name: 'Демо-партия' })).toBeTruthy()
    expect(GET).toHaveBeenCalledWith('/api/games/{game_id}', {
      params: { path: { game_id: 'g1' } },
    })
    expect(screen.getByText(/Раунд 1 из 6/)).toBeTruthy()
    expect(screen.getByText('RUS-L75WVG')).toBeTruthy()
    expect(screen.getByText('вошли')).toBeTruthy()
    expect(screen.getByText('ещё не вошли')).toBeTruthy()
    expect(screen.getByText('бот')).toBeTruthy()
    expect(screen.queryByText('DPR-D3WS38')).toBeNull()
  })

  it('falls back to a generic title for an untitled game', async () => {
    GET.mockResolvedValue({ data: { ...GAME, title: '' } } as never)
    renderAt('/host/g1')
    expect(await screen.findByText(/Раунд 1 из 6/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
  })

  it('shows only the header when the game is not available', async () => {
    GET.mockResolvedValue({ data: undefined } as never)
    renderAt('/host/g1')
    await vi.waitFor(() => expect(GET).toHaveBeenCalled())
    expect(screen.getByRole('heading', { name: 'Панель ведущего' })).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('does not call the API without a game id', () => {
    renderWithSession(<Route path="/" element={<HostPage />} />, {
      session: fakeSession({ principal: HOST }),
    })
    expect(GET).not.toHaveBeenCalled()
  })
})
