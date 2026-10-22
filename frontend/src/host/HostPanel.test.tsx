import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type RoundStatus } from '../api/client'
import { gameInfo, hostStatus } from '../test/host'
import HostPanel from './HostPanel'

vi.mock('../api/client', () => ({
  api: { POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const POST = vi.mocked(api.POST)

const RESULT = {
  round: 1,
  events: 12,
  next_round: 2,
  finished: false,
  standings: [
    ['usa', 6000],
    ['russia', 4567],
  ] as [string, number][],
}

function setup(over: { game?: ReturnType<typeof gameInfo>; status?: RoundStatus | null } = {}) {
  const onChanged = vi.fn()
  render(
    <HostPanel
      gameId="g1"
      game={over.game ?? gameInfo()}
      status={over.status === undefined ? hostStatus() : over.status}
      onChanged={onChanged}
    />,
  )
  return onChanged
}

const resolveButton = () => screen.getByRole('button', { name: 'Подвести итоги раунда 1' })

describe('HostPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    POST.mockResolvedValue({ data: RESULT } as never)
  })

  it('shows the round, the phase and how many teams are ready', () => {
    setup()
    expect(screen.getByRole('heading', { name: 'Раунд 1 из 6' })).toBeTruthy()
    expect(screen.getByText('приём приказов')).toBeTruthy()
    expect(screen.getByText(/Приказы отправили 0 из 2/)).toBeTruthy()
  })

  it('offers to resolve without waiting for everyone', () => {
    setup()
    expect(screen.getByText(/можно подвести итоги и без них/)).toBeTruthy()
  })

  it('drops the hint once every human has submitted', () => {
    setup({ status: hostStatus({ submitted: { russia: true, usa: true, dprk: true } }) })
    expect(screen.getByText('Приказы отправили 2 из 2')).toBeTruthy()
    expect(screen.queryByText(/без них/)).toBeNull()
  })

  it('resolves the round the host sees, not the one the server may have moved to', async () => {
    setup({ game: gameInfo({ current_round: 3 }), status: hostStatus({ round: 3 }) })
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 3' }))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/resolve', {
      params: { path: { game_id: 'g1', number: 3 } },
    })
  })

  it('reports the result and the standings', async () => {
    const onChanged = setup()
    await userEvent.click(resolveButton())
    expect(await screen.findByText(/Раунд 1 завершён: событий 12/)).toBeTruthy()
    expect(screen.getByText(/Следующий раунд — 2/)).toBeTruthy()
    expect(screen.getByText('60.00 %')).toBeTruthy()
    expect(onChanged).toHaveBeenCalledOnce()
  })

  it('says when the last round is over instead of promising the next one', async () => {
    POST.mockResolvedValue({
      data: { ...RESULT, round: 6, next_round: null, finished: true },
    } as never)
    setup({ game: gameInfo({ current_round: 6 }), status: hostStatus({ round: 6 }) })
    await userEvent.click(screen.getByRole('button', { name: 'Подвести итоги раунда 6' }))
    expect(await screen.findByText(/Это был последний раунд/)).toBeTruthy()
    expect(screen.queryByText(/Следующий раунд/)).toBeNull()
  })

  it('locks the button while resolving, so one click cannot resolve twice', async () => {
    let resolve!: (v: unknown) => void
    POST.mockReturnValue(new Promise((r) => (resolve = r)) as never)
    setup()
    await userEvent.click(resolveButton())
    expect(screen.getByRole('button', { name: 'Подводим итоги…' })).toHaveProperty('disabled', true)
    resolve({ data: RESULT })
    await waitFor(() => expect(screen.getByText(/Раунд 1 завершён/)).toBeTruthy())
  })

  it('shows the conflict when the round was already resolved elsewhere', async () => {
    POST.mockResolvedValue({
      data: undefined,
      error: { detail: 'round 1 is already resolved; current round is 2' },
    } as never)
    const onChanged = setup()
    await userEvent.click(resolveButton())
    expect((await screen.findByRole('alert')).textContent).toBe(
      'round 1 is already resolved; current round is 2',
    )
    expect(onChanged).not.toHaveBeenCalled()
  })

  it('hides the button while the engine is resolving', () => {
    setup({ status: hostStatus({ phase: 'resolving' }) })
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
    expect(screen.getByText('Итоги уже подводятся, обновите страницу.')).toBeTruthy()
  })

  it('hides the button for good once the game is finished', () => {
    setup({ game: gameInfo({ phase: 'done' }), status: hostStatus({ phase: 'done' }) })
    expect(screen.getByText('Игра завершена.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Подвести итоги/ })).toBeNull()
  })

  it('falls back to the game phase when the round status is unknown', () => {
    setup({ status: null })
    expect(screen.getByText('приём приказов')).toBeTruthy()
    expect(screen.getByText('Итоги уже подводятся, обновите страницу.')).toBeTruthy()
  })

  it('awards the laugh prize for the current round', async () => {
    const onChanged = setup()
    await userEvent.click(within(screen.getByText(/Россия/).closest('tr')!).getByRole('button'))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/laugh', {
      params: { path: { game_id: 'g1', number: 1 }, query: { country_id: 'russia' } },
    })
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce())
  })

  it('sends an empty query to take the prize back', async () => {
    setup({ status: hostStatus({ laugh_winner: 'russia' }) })
    await userEvent.click(screen.getByRole('button', { name: 'Снять приз' }))
    expect(POST).toHaveBeenCalledWith('/api/games/{game_id}/rounds/{number}/laugh', {
      params: { path: { game_id: 'g1', number: 1 }, query: {} },
    })
  })

  it('reports a failed prize award', async () => {
    POST.mockResolvedValue({ data: undefined, error: { detail: 'no country atlantis' } } as never)
    const onChanged = setup()
    await userEvent.click(within(screen.getByText(/Россия/).closest('tr')!).getByRole('button'))
    expect((await screen.findByRole('alert')).textContent).toBe('no country atlantis')
    expect(onChanged).not.toHaveBeenCalled()
  })
})
