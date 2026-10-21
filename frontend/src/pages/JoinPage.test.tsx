import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { JoinError } from '../session-core'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import JoinPage from './JoinPage'

function setup(join = vi.fn(), principal: typeof HOST | null = null) {
  const session = fakeSession({ join, principal })
  renderWithSession(<Route path="/" element={<JoinPage />} />, { session })
  return session
}

async function submit(code: string) {
  await userEvent.type(screen.getByLabelText('Код'), code)
  await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

const location = () => screen.getByTestId('location').textContent

describe('JoinPage', () => {
  it('button is disabled until the code has 4+ characters', async () => {
    setup()
    const button = screen.getByRole('button', { name: 'Войти' })
    expect(button).toHaveProperty('disabled', true)
    await userEvent.type(screen.getByLabelText('Код'), 'HOS')
    expect(button).toHaveProperty('disabled', true)
    await userEvent.type(screen.getByLabelText('Код'), 'T')
    expect(button).toHaveProperty('disabled', false)
  })

  it('on success goes to the principal home', async () => {
    const join = vi.fn().mockResolvedValue(HOST)
    setup(join)
    await submit('HOST-DZRS3A')
    expect(join).toHaveBeenCalledWith('HOST-DZRS3A')
    await waitFor(() => expect(location()).toBe('/host/g1'))
  })

  it('shows "Входим…" while the request is in flight', async () => {
    let resolve!: (v: typeof HOST) => void
    setup(vi.fn(() => new Promise<typeof HOST>((r) => (resolve = r))))
    await submit('HOST-DZRS3A')
    expect(screen.getByRole('button', { name: 'Входим…' })).toHaveProperty('disabled', true)
    resolve(HOST)
    await waitFor(() => expect(location()).toBe('/host/g1'))
  })

  it.each([
    [404, 'Такого кода нет. Проверьте, нет ли опечатки.'],
    [409, 'Этой страной управляет бот — у неё нет игроков.'],
  ])('maps %i to a friendly message', async (status, text) => {
    setup(vi.fn().mockRejectedValue(new JoinError(status, 'raw')))
    await submit('XXXX-1')
    expect((await screen.findByRole('alert')).textContent).toBe(text)
    expect(screen.getByRole('button', { name: 'Войти' })).toHaveProperty('disabled', false)
  })

  it('an unmapped status shows the server detail', async () => {
    setup(vi.fn().mockRejectedValue(new JoinError(422, 'code: field required')))
    await submit('XXXX-1')
    expect((await screen.findByRole('alert')).textContent).toBe('code: field required')
  })

  it('a network error says the server is unavailable', async () => {
    setup(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await submit('RUS-L75WVG')
    expect((await screen.findByRole('alert')).textContent).toBe('Сервер недоступен')
  })

  it('a new attempt clears the previous error', async () => {
    const join = vi.fn().mockRejectedValueOnce(new JoinError(404, 'x')).mockResolvedValue(HOST)
    setup(join)
    await submit('XXXX-1')
    await screen.findByRole('alert')
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await waitFor(() => expect(location()).toBe('/host/g1'))
  })

  it('offers a way back to a host already in a game', () => {
    setup(vi.fn(), HOST)
    expect(screen.getByText(/как ведущий/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'вернуться' }).getAttribute('href')).toBe('/host/g1')
  })

  it('names the country of a player already in a game', () => {
    setup(vi.fn(), { game_id: 'g1', role: 'player', country_id: 'russia' })
    expect(screen.getByText(/как russia/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'вернуться' }).getAttribute('href')).toBe('/play/g1')
  })

  it('links to game creation', () => {
    setup()
    expect(screen.getByRole('link', { name: 'Создать игру' }).getAttribute('href')).toBe('/new')
  })
})
