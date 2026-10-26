import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../api/client'
import { actionSpace, option } from '../test/actions'
import { foreign, me, observation, ownCity } from '../test/observation'
import OrdersForm from './OrdersForm'

vi.mock('../api/client', () => ({
  api: { PUT: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
  orderErrors: (e: unknown) =>
    e &&
    typeof e === 'object' &&
    'errors' in e &&
    Array.isArray((e as { errors: unknown[] }).errors)
      ? (e as { errors: { action: string; target?: string | null; reason: string }[] }).errors
      : [],
}))
const PUT = vi.mocked(api.PUT)

/** Russia with two cities, the USA with one — matches the ids in actionSpace(). */
const OBS = observation({
  me: me({ cities: [ownCity(), ownCity({ id: 'spb', name: 'Петербург' })] }),
  others: [
    foreign({
      cities: [
        { id: 'nyc', name: 'Нью-Йорк', destroyed: false, life_level: 6000 },
        { id: 'la', name: 'Лос-Анджелес', destroyed: false, life_level: 5000 },
      ],
    }),
  ],
})

function setup(space = actionSpace(), onSubmitted = vi.fn()) {
  render(<OrdersForm gameId="g1" space={space} observation={OBS} onSubmitted={onSubmitted} />)
  return onSubmitted
}

const submitButton = () => screen.getByRole('button', { name: 'Отправить приказы' })
const body = () => PUT.mock.calls[0][1]!.body

describe('OrdersForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    PUT.mockResolvedValue({ data: undefined, error: undefined } as never)
  })

  it('refuses to send an empty order', () => {
    setup()
    expect(submitButton()).toHaveProperty('disabled', true)
  })

  it('names every action with its price from the rules', () => {
    setup()
    expect(screen.getByText(/Инвестировать в развитие города/)).toBeTruthy()
    expect(screen.getByText('150 $')).toBeTruthy()
    expect(screen.getByText(/Запустить экологическую программу/)).toBeTruthy()
    expect(screen.getByText('200 $')).toBeTruthy()
  })

  it('shows own cities by name and foreign cities with their country', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          strike: option({
            ...actionSpace().actions.strike,
            available: true,
            reason: null,
            targets: ['nyc'],
            max_count: 1,
          }),
        },
      }),
    )
    expect(screen.getAllByText('Москва').length).toBeGreaterThan(0)
    expect(screen.getByText('США · Нью-Йорк')).toBeTruthy()
  })

  it('counts spending as the player picks targets', async () => {
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    expect(screen.getByText(/Потрачено 150 \$ из/)).toBeTruthy()
  })

  it('blocks submission over budget and says by how much', async () => {
    setup(actionSpace({ budget: 200 }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Петербург' })[0])
    expect(screen.getByText(/Расходы превышают бюджет на 100 \$/)).toBeTruthy()
    expect(submitButton()).toHaveProperty('disabled', true)
  })

  it('sends exactly what the player filled in', async () => {
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.type(screen.getByLabelText(/Сколько программ/), '1')
    await userEvent.click(screen.getByLabelText('Разработать в этом раунде'))
    await userEvent.click(submitButton())

    expect(PUT).toHaveBeenCalledWith('/api/games/{game_id}/orders', {
      params: { path: { game_id: 'g1' } },
      body: {
        invest: ['moscow', 'moscow'],
        eco_programs: 1,
        nuclear_tech: true,
        bombs: 0,
        strikes: [],
        shields: [],
        sanctions: [],
        aid: {},
      },
    })
  })

  it('sends shields, sanctions and aid', async () => {
    setup()
    const shield = screen.getByText(/Построить ядерный щит/).closest('section')!
    await userEvent.click(within(shield).getByLabelText('Петербург'))
    const sanction = screen.getByText(/Наложить экономические санкции/).closest('section')!
    await userEvent.click(within(sanction).getByLabelText('США'))
    const aid = screen.getByText(/Материальная помощь/).closest('section')!
    await userEvent.type(within(aid).getByLabelText('США'), '50')
    await userEvent.click(submitButton())

    expect(body()).toMatchObject({ shields: ['spb'], sanctions: ['usa'], aid: { usa: 50 } })
  })

  it('confirms a successful submission and tells the player it can be replaced', async () => {
    const onSubmitted = setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    expect(
      await screen.findByText('Приказы отправлены. Их можно переотправить до конца раунда.'),
    ).toBeTruthy()
    expect(onSubmitted).toHaveBeenCalledOnce()
  })

  it('drops the confirmation once the draft changes again', async () => {
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    await screen.findByText(/Приказы отправлены/)
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Петербург' })[0])
    expect(screen.queryByText(/Приказы отправлены/)).toBeNull()
  })

  it('shows "Отправляем…" while the request is in flight', async () => {
    let resolve!: (v: unknown) => void
    PUT.mockReturnValue(new Promise((r) => (resolve = r)) as never)
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    expect(screen.getByRole('button', { name: 'Отправляем…' })).toHaveProperty('disabled', true)
    resolve({ error: undefined })
    await waitFor(() => expect(screen.getByText(/Приказы отправлены/)).toBeTruthy())
  })

  it('puts a rejection from the engine under the action it belongs to', async () => {
    PUT.mockResolvedValue({
      error: {
        detail: 'orders rejected',
        errors: [{ action: 'invest', target: 'moscow', reason: 'limit_exceeded' }],
      },
    } as never)
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())

    const invest = screen.getByText(/Инвестировать/).closest('section')!
    expect(within(invest).getByRole('alert').textContent).toBe('Москва: превышен лимит на раунд')
  })

  it('joins several rejections of one action', async () => {
    PUT.mockResolvedValue({
      error: {
        errors: [
          { action: 'aid', target: 'usa', reason: 'below_minimum' },
          { action: 'aid', reason: 'limit_exceeded' },
        ],
      },
    } as never)
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())

    const aid = screen.getByText(/Материальная помощь/).closest('section')!
    expect(within(aid).getByRole('alert').textContent).toBe(
      'США: сумма меньше минимальной; превышен лимит на раунд',
    )
  })

  it('falls back to the plain message when the error carries no errors[]', async () => {
    PUT.mockResolvedValue({ error: { detail: 'orders are closed: phase is resolving' } } as never)
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    expect((await screen.findByRole('alert')).textContent).toBe(
      'orders are closed: phase is resolving',
    )
  })

  it('clears previous rejections on the next attempt', async () => {
    PUT.mockResolvedValueOnce({
      error: { errors: [{ action: 'invest', reason: 'limit_exceeded' }] },
    } as never).mockResolvedValueOnce({ error: undefined } as never)
    setup()
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    await screen.findByRole('alert')
    await userEvent.click(submitButton())
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('greys out an action the engine blocked and hides its controls', () => {
    setup()
    const bomb = screen.getByText(/Произвести ядерные бомбы/).closest('section')!
    expect(bomb.className).toContain('off')
    expect(screen.getByText('нужна ядерная технология')).toBeTruthy()
    expect(within(bomb).queryByRole('spinbutton')).toBeNull()
  })

  it('shows the per-round cap on bombs', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          bomb: option({ ...actionSpace().actions.bomb, available: true, reason: null }),
        },
      }),
    )
    expect(screen.getByText(/Бомбы: 0 из 3/)).toBeTruthy()
  })

  it('skips an action the rules do not define at all', () => {
    const space = actionSpace()
    delete (space.actions as Record<string, unknown>).aid
    setup(space)
    expect(screen.queryByText(/Материальная помощь/)).toBeNull()
  })

  it('clamps bombs to zero when the field is emptied or negated', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          bomb: option({ ...actionSpace().actions.bomb, available: true, reason: null }),
        },
      }),
    )
    const bombs = screen.getByLabelText(/Сколько бомб/)
    fireEvent.change(bombs, { target: { value: '2' } })
    expect(screen.getByText(/Потрачено 300 \$ из/)).toBeTruthy()
    fireEvent.change(bombs, { target: { value: '' } })
    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
    fireEvent.change(bombs, { target: { value: '-1' } })
    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
  })

  it('names an unknown target id instead of hiding the rejection', async () => {
    PUT.mockResolvedValue({
      error: { errors: [{ action: 'strike', target: 'atlantis', reason: 'invalid_target' }] },
    } as never)
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          strike: option({
            ...actionSpace().actions.strike,
            available: true,
            reason: null,
            targets: ['nyc'],
            max_count: 1,
          }),
        },
      }),
    )
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])
    await userEvent.click(submitButton())
    const strike = screen.getByText(/Нанести ядерный удар/).closest('section')!
    expect(within(strike).getByRole('alert').textContent).toBe('atlantis: недопустимая цель')
  })

  it('renders an aid field with no targets at all', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          aid: option({ ...actionSpace().actions.aid, targets: null }),
        },
      }),
    )
    const aid = screen.getByText(/Материальная помощь/).closest('section')!
    expect(within(aid).queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('renders toggles with no targets at all', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          shield: option({ ...actionSpace().actions.shield, targets: null }),
        },
      }),
    )
    const shield = screen.getByText(/Построить ядерный щит/).closest('section')!
    expect(within(shield).queryAllByRole('checkbox')).toHaveLength(0)
  })

  it('clamps eco programs to zero when emptied or negated', () => {
    setup()
    const field = screen.getByLabelText(/Сколько программ/)
    // A number input lets "" and "-5" through on paste; neither may become income.
    fireEvent.change(field, { target: { value: '2' } })
    expect(screen.getByText(/Потрачено 400 \$ из/)).toBeTruthy()
    fireEvent.change(field, { target: { value: '' } })
    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
    fireEvent.change(field, { target: { value: '-5' } })
    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
    expect(submitButton()).toHaveProperty('disabled', true)
  })

  it('leaves the bomb field uncapped when the rules set no per-round limit', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          bomb: option({
            ...actionSpace().actions.bomb,
            available: true,
            reason: null,
            max_count: null,
          }),
        },
      }),
    )
    expect(screen.getByText(/лимита нет/)).toBeTruthy()
    expect(screen.getByLabelText(/Сколько бомб/).getAttribute('max')).toBeNull()
  })

  it('stops the bomb stepper at the per-round cap', () => {
    setup(
      actionSpace({
        actions: {
          ...actionSpace().actions,
          bomb: option({ ...actionSpace().actions.bomb, available: true, reason: null }),
        },
      }),
    )
    const plus = screen.getByRole('button', { name: 'Добавить бомбу' })
    fireEvent.click(plus)
    fireEvent.click(plus)
    fireEvent.click(plus)
    expect(screen.getByText(/Бомбы: 3 из 3/)).toBeTruthy()
    expect(plus).toHaveProperty('disabled', true)
    expect(screen.getByText(/Потрачено 450 \$ из/)).toBeTruthy()
  })
})

describe('OrdersForm when the action space changes under it', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    PUT.mockResolvedValue({ data: undefined, error: undefined } as never)
  })

  const alreadyOwned = () =>
    actionSpace({
      actions: {
        ...actionSpace().actions,
        nuclear_tech: option({
          ...actionSpace().actions.nuclear_tech,
          available: false,
          reason: 'already_owned',
        }),
      },
    })

  // The reported bug: the technology was developed last round, its checkbox is hidden,
  // and the tick left in the draft kept charging 500$ so orders could never be sent.
  it('drops a technology the player developed, so orders can be sent again', async () => {
    const { rerender } = render(
      <OrdersForm gameId="g1" space={actionSpace()} observation={OBS} onSubmitted={vi.fn()} />,
    )
    await userEvent.click(screen.getByLabelText('Разработать в этом раунде'))
    expect(screen.getByText(/Потрачено 500 \$ из/)).toBeTruthy()

    rerender(
      <OrdersForm gameId="g1" space={alreadyOwned()} observation={OBS} onSubmitted={vi.fn()} />,
    )

    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
    expect(screen.getByText('уже есть')).toBeTruthy()
    expect(submitButton()).toHaveProperty('disabled', true)

    // And a fresh pick is sendable: the draft is empty, not stuck.
    const shield = screen.getByText(/Построить ядерный щит/).closest('section')!
    await userEvent.click(within(shield).getByLabelText('Москва'))
    expect(submitButton()).toHaveProperty('disabled', false)
  })

  it('sends nothing the rules dropped', async () => {
    const { rerender } = render(
      <OrdersForm gameId="g1" space={actionSpace()} observation={OBS} onSubmitted={vi.fn()} />,
    )
    await userEvent.click(screen.getByLabelText('Разработать в этом раунде'))
    const shield = screen.getByText(/Построить ядерный щит/).closest('section')!
    await userEvent.click(within(shield).getByLabelText('Москва'))

    rerender(
      <OrdersForm gameId="g1" space={alreadyOwned()} observation={OBS} onSubmitted={vi.fn()} />,
    )
    await userEvent.click(submitButton())

    expect(body()).toMatchObject({ nuclear_tech: false, shields: ['moscow'] })
  })

  it('drops bombs the engine stops offering', async () => {
    const withBombs = actionSpace({
      actions: {
        ...actionSpace().actions,
        bomb: option({ ...actionSpace().actions.bomb, available: true, reason: null }),
      },
    })
    const { rerender } = render(
      <OrdersForm gameId="g1" space={withBombs} observation={OBS} onSubmitted={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText(/Сколько бомб/), { target: { value: '2' } })
    expect(screen.getByText(/Потрачено 300 \$ из/)).toBeTruthy()

    rerender(
      <OrdersForm gameId="g1" space={actionSpace()} observation={OBS} onSubmitted={vi.fn()} />,
    )

    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
    expect(screen.getByText('нужна ядерная технология')).toBeTruthy()
  })

  it('drops a target that is gone from the new targets list', async () => {
    const { rerender } = render(
      <OrdersForm gameId="g1" space={actionSpace()} observation={OBS} onSubmitted={vi.fn()} />,
    )
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Петербург' })[0])
    expect(screen.getByText(/Потрачено 150 \$ из/)).toBeTruthy()

    rerender(
      <OrdersForm
        gameId="g1"
        space={actionSpace({
          actions: {
            ...actionSpace().actions,
            invest: option({ ...actionSpace().actions.invest, targets: ['moscow'] }),
          },
        })}
        observation={OBS}
        onSubmitted={vi.fn()}
      />,
    )

    expect(screen.getByText(/Потрачено 0 \$ из/)).toBeTruthy()
  })

  it('keeps the draft when the new space allows it', async () => {
    const { rerender } = render(
      <OrdersForm gameId="g1" space={actionSpace()} observation={OBS} onSubmitted={vi.fn()} />,
    )
    await userEvent.click(screen.getAllByRole('button', { name: 'Добавить Москва' })[0])

    rerender(
      <OrdersForm
        gameId="g1"
        space={actionSpace({ budget: 2000 })}
        observation={OBS}
        onSubmitted={vi.fn()}
      />,
    )

    expect(screen.getByText(/Потрачено 150 \$ из/)).toBeTruthy()
  })

  it('clamps the bomb draft when the cap drops under it', () => {
    const wide = actionSpace({
      actions: {
        ...actionSpace().actions,
        bomb: option({ ...actionSpace().actions.bomb, available: true, reason: null }),
      },
    })
    const { rerender } = render(
      <OrdersForm gameId="g1" space={wide} observation={OBS} onSubmitted={vi.fn()} />,
    )
    fireEvent.change(screen.getByLabelText(/Сколько бомб/), { target: { value: '3' } })
    expect(screen.getByText(/Потрачено 450 \$ из/)).toBeTruthy()

    rerender(
      <OrdersForm
        gameId="g1"
        space={actionSpace({
          actions: {
            ...actionSpace().actions,
            bomb: option({
              ...actionSpace().actions.bomb,
              available: true,
              reason: null,
              max_count: 1,
            }),
          },
        })}
        observation={OBS}
        onSubmitted={vi.fn()}
      />,
    )

    expect(screen.getByText(/Потрачено 150 \$ из/)).toBeTruthy()
    expect(screen.getByText(/Бомбы: 1 из 1/)).toBeTruthy()
  })
})
