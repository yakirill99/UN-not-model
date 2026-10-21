import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router'
import { describe, expect, it } from 'vitest'
import { fakeSession, HOST, renderWithSession } from '../test/session'
import Header from './Header'

describe('Header', () => {
  it('renders title and optional subtitle', () => {
    renderWithSession(<Route path="/" element={<Header title="Россия" subtitle="Раунд 1" />} />)
    expect(screen.getByRole('heading', { name: 'Россия' })).toBeTruthy()
    expect(screen.getByText('Раунд 1')).toBeTruthy()
  })

  it('omits the subtitle when not given', () => {
    const { container } = renderWithSession(<Route path="/" element={<Header title="Панель" />} />)
    expect(container.querySelector('p.muted')).toBeNull()
  })

  it('"Выйти" logs out and returns to the join page', async () => {
    const session = fakeSession({ principal: HOST })
    renderWithSession(<Route path="/host/:gameId" element={<Header title="Панель" />} />, {
      at: '/host/g1',
      session,
    })
    await userEvent.click(screen.getByRole('button', { name: 'Выйти' }))
    expect(session.logout).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.getByTestId('location').textContent).toBe('/'))
  })
})
