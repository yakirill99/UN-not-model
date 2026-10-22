import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { gameInfo, hostStatus } from '../test/host'
import { teams } from './core'
import TeamTable from './TeamTable'

const render_ = (status = hostStatus(), onLaugh = vi.fn(), busy = false) => {
  render(<TeamTable list={teams(gameInfo(), status)} onLaugh={onLaugh} busy={busy} />)
  return onLaugh
}
const rowOf = (name: string) => screen.getByText(new RegExp(name)).closest('tr')!

describe('TeamTable', () => {
  it('shows a code the host can read out loud', () => {
    render_()
    expect(within(rowOf('Россия')).getByText('RUS-L75WVG')).toBeTruthy()
  })

  it('shows a bot without a code and without a status', () => {
    render_()
    const row = rowOf('КНДР')
    expect(within(row).getByText('бот')).toBeTruthy()
    expect(within(row).queryByRole('button')).toBeNull()
  })

  it.each([
    ['ещё не вошли', hostStatus(), 'США'],
    ['приказы не отправлены', hostStatus(), 'Россия'],
    ['приказы приняты', hostStatus({ submitted: { russia: true } }), 'Россия'],
  ])('reports "%s"', (expected, status, name) => {
    render_(status)
    expect(within(rowOf(name)).getByText(expected)).toBeTruthy()
  })

  it('awards the laugh prize to a team', async () => {
    const onLaugh = render_()
    await userEvent.click(within(rowOf('Россия')).getByRole('button', { name: 'Приз за юмор' }))
    expect(onLaugh).toHaveBeenCalledWith('russia')
  })

  it('takes the prize back by sending null', async () => {
    const onLaugh = render_(hostStatus({ laugh_winner: 'russia' }))
    const row = rowOf('Россия')
    expect(within(row).getByTitle('Приз за юмор')).toBeTruthy()
    await userEvent.click(within(row).getByRole('button', { name: 'Снять приз' }))
    expect(onLaugh).toHaveBeenCalledWith(null)
  })

  it('locks the prize buttons while a request is in flight', () => {
    render_(hostStatus(), vi.fn(), true)
    expect(within(rowOf('Россия')).getByRole('button')).toHaveProperty('disabled', true)
  })
})
