import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type GameInfo } from '../api/client'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import NewGamePage from './NewGamePage'

vi.mock('../api/client', () => ({
  api: { POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))
const POST = vi.mocked(api.POST)

const CREATED: GameInfo = {
  id: 'g1',
  title: 'Тест',
  current_round: 1,
  rounds_total: 6,
  scenario_id: 'equal',
  rules_version: '1.0.0',
  mode: 'live',
  phase: 'orders',
  status: 'active',
  seed: 7,
  host_code: 'HOST-AAAAAA',
  players: [
    { country_id: 'russia', name: 'Россия', kind: 'human', join_code: 'RUS-BBBBBB', joined: false },
    { country_id: 'dprk', name: 'КНДР', kind: 'bot', join_code: null, joined: false },
  ],
}

function setup(join = vi.fn().mockResolvedValue(HOST)) {
  return renderWithSession(<Route path="/new" element={<NewGamePage />} />, {
    at: '/new',
    session: fakeSession({ join }),
  })
}

const location = () => screen.getByTestId('location').textContent

describe('NewGamePage', () => {
  beforeEach(() => vi.resetAllMocks())

  it('sends the default form: smolny, seed 1, three default bots', async () => {
    POST.mockResolvedValue({ data: CREATED } as never)
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect(POST).toHaveBeenCalledWith('/api/games', {
      body: {
        rules: 'v1.0',
        title: '',
        scenario: 'smolny',
        seed: 1,
        mode: 'live',
        bots: [
          { country_id: 'france', bot: 'ecologist' },
          { country_id: 'iran', bot: 'economist' },
          { country_id: 'dprk', bot: 'aggressor' },
        ],
      },
    })
  })

  it('sends every field the host changed', async () => {
    POST.mockResolvedValue({ data: CREATED } as never)
    setup()
    await userEvent.type(screen.getByLabelText('Название'), 'Тест')
    await userEvent.selectOptions(screen.getByLabelText('Сценарий'), 'equal')
    const seed = screen.getByLabelText('Seed (для повторяемости)')
    await userEvent.clear(seed)
    await userEvent.type(seed, '7')
    const [russia, , france] = screen.getAllByRole('combobox').slice(1)
    await userEvent.selectOptions(russia, 'random')
    await userEvent.selectOptions(france, '')
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(POST.mock.calls[0][1]).toMatchObject({
      body: {
        title: 'Тест',
        scenario: 'equal',
        seed: 7,
        bots: [
          { country_id: 'russia', bot: 'random' },
          { country_id: 'iran', bot: 'economist' },
          { country_id: 'dprk', bot: 'aggressor' },
        ],
      },
    })
  })

  it('shows "Создаём…" while the request is in flight', async () => {
    let resolve!: (v: unknown) => void
    POST.mockReturnValue(new Promise((r) => (resolve = r)) as never)
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect(screen.getByRole('button', { name: 'Создаём…' })).toHaveProperty('disabled', true)
    resolve({ data: CREATED })
    expect(await screen.findByRole('heading', { name: 'Игра создана' })).toBeTruthy()
  })

  it('shows the server error and keeps the form', async () => {
    POST.mockResolvedValue({ data: undefined, error: { detail: 'unknown scenario' } } as never)
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect((await screen.findByRole('alert')).textContent).toBe('unknown scenario')
    expect(screen.getByRole('button', { name: 'Создать' })).toHaveProperty('disabled', false)
  })

  it('after creation shows the codes, hides bot codes, enters as host', async () => {
    POST.mockResolvedValue({ data: CREATED } as never)
    const join = vi.fn().mockResolvedValue(HOST)
    setup(join)
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))

    expect(await screen.findByText('HOST-AAAAAA')).toBeTruthy()
    expect(screen.getByText('RUS-BBBBBB')).toBeTruthy()
    expect(screen.getByText('бот')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'Войти как ведущий' }))
    expect(join).toHaveBeenCalledWith('HOST-AAAAAA')
    await waitFor(() => expect(location()).toBe('/host/g1'))
  })

  it('"Войти как ведущий" does nothing if the server returned no host code', async () => {
    POST.mockResolvedValue({ data: { ...CREATED, host_code: null } } as never)
    const join = vi.fn()
    setup(join)
    await userEvent.click(screen.getByRole('button', { name: 'Создать' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Войти как ведущий' }))
    expect(join).not.toHaveBeenCalled()
  })

  it('links back to the join page', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Назад ко входу по коду' }).getAttribute('href')).toBe(
      '/',
    )
  })
})
