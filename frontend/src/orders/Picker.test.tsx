import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { option } from '../test/actions'
import { nameOf } from './names'
import { ActionHeader, AidFields, TargetCounters, TargetToggles } from './Picker'

const names = { moscow: 'Москва', spb: 'Петербург', usa: 'США' }

describe('nameOf', () => {
  it('translates a known id', () => {
    expect(nameOf(names, 'moscow')).toBe('Москва')
  })

  it('shows the raw id when the name is unknown', () => {
    expect(nameOf(names, 'atlantis')).toBe('atlantis')
  })
})

describe('ActionHeader', () => {
  it('shows the price of an available action', () => {
    render(<ActionHeader option={option({ id: 'invest', cost: 150 })} id="invest" />)
    expect(screen.getByText('150 $')).toBeTruthy()
  })

  it('calls a free action free', () => {
    render(<ActionHeader option={option({ id: 'strike', cost: 0 })} id="strike" />)
    expect(screen.getByText('бесплатно')).toBeTruthy()
  })

  it('explains why a blocked action is blocked', () => {
    render(
      <ActionHeader
        option={option({ id: 'bomb', available: false, reason: 'no_bombs' })}
        id="bomb"
      />,
    )
    expect(screen.getByText('нет готовых бомб')).toBeTruthy()
  })
})

describe('TargetCounters', () => {
  const invest = option({ id: 'invest', targets: ['moscow', 'spb'] })

  it('adds a target on +', async () => {
    const onChange = vi.fn()
    render(
      <TargetCounters option={invest} names={names} picked={[]} left={null} onChange={onChange} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Добавить Москва' }))
    expect(onChange).toHaveBeenCalledWith(['moscow'])
  })

  it('repeats the same target, as investments may', async () => {
    const onChange = vi.fn()
    render(
      <TargetCounters
        option={invest}
        names={names}
        picked={['moscow']}
        left={null}
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Добавить Москва' }))
    expect(onChange).toHaveBeenCalledWith(['moscow', 'moscow'])
  })

  it('removes only one unit of a repeated target', async () => {
    const onChange = vi.fn()
    render(
      <TargetCounters
        option={invest}
        names={names}
        picked={['moscow', 'moscow', 'spb']}
        left={null}
        onChange={onChange}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Убрать Москва' }))
    expect(onChange).toHaveBeenCalledWith(['moscow', 'spb'])
  })

  it('shows the count per target', () => {
    render(
      <TargetCounters
        option={invest}
        names={names}
        picked={['moscow', 'moscow']}
        left={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getAllByText('2')).toHaveLength(1)
  })

  it('cannot remove what was never added', () => {
    render(
      <TargetCounters option={invest} names={names} picked={[]} left={null} onChange={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Убрать Москва' })).toHaveProperty('disabled', true)
  })

  it('stops at max_per_target', () => {
    const strike = option({ id: 'strike', targets: ['nyc'], max_per_target: 1 })
    render(
      <TargetCounters
        option={strike}
        names={{ nyc: 'Нью-Йорк' }}
        picked={['nyc']}
        left={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Добавить Нью-Йорк' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('stops when the round limit is used up', () => {
    render(<TargetCounters option={invest} names={names} picked={[]} left={0} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Добавить Москва' })).toHaveProperty('disabled', true)
  })

  it('locks both buttons while the form is busy', () => {
    render(
      <TargetCounters
        option={invest}
        names={names}
        picked={['moscow']}
        left={null}
        onChange={vi.fn()}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Добавить Москва' })).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Убрать Москва' })).toHaveProperty('disabled', true)
  })

  it('renders nothing when the engine offers no targets', () => {
    render(
      <TargetCounters
        option={option({ id: 'strike', targets: null })}
        names={names}
        picked={[]}
        left={null}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })
})

describe('TargetToggles', () => {
  const shield = option({ id: 'shield', targets: ['moscow', 'spb'] })

  it('picks a target', async () => {
    const onChange = vi.fn()
    render(<TargetToggles option={shield} names={names} picked={[]} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Москва'))
    expect(onChange).toHaveBeenCalledWith(['moscow'])
  })

  it('unpicks a target', async () => {
    const onChange = vi.fn()
    render(<TargetToggles option={shield} names={names} picked={['moscow']} onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('Москва'))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('reflects what is already picked', () => {
    render(<TargetToggles option={shield} names={names} picked={['spb']} onChange={vi.fn()} />)
    expect(screen.getByLabelText('Петербург')).toHaveProperty('checked', true)
    expect(screen.getByLabelText('Москва')).toHaveProperty('checked', false)
  })

  it('locks while busy', () => {
    render(<TargetToggles option={shield} names={names} picked={[]} onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('Москва')).toHaveProperty('disabled', true)
  })
})

describe('AidFields', () => {
  const aid = option({ id: 'aid', targets: ['usa'], min_amount: 1 })

  it('adds a step of 50 per click and formats it as money', async () => {
    const onChange = vi.fn()
    render(<AidFields option={aid} names={names} aid={{}} onChange={onChange} budgetLeft={1000} />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить помощь США' }))
    expect(onChange).toHaveBeenCalledWith({ usa: 50 })
    expect(screen.getByLabelText('Сумма помощи США').textContent).toBe('0 $')
  })

  it('drops the recipient once the amount is back to zero', async () => {
    const onChange = vi.fn()
    render(
      <AidFields
        option={aid}
        names={names}
        aid={{ usa: 50 }}
        onChange={onChange}
        budgetLeft={950}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Убрать помощь США' }))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('never offers more than the budget still has', async () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <AidFields option={aid} names={names} aid={{}} onChange={onChange} budgetLeft={80} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Добавить помощь США' }))
    expect(onChange).toHaveBeenLastCalledWith({ usa: 50 })

    // The parent stores the draft and hands it back: the rerender is the flow
    // OrdersForm runs through, and it shrinks what the budget can still give.
    rerender(
      <AidFields
        option={aid}
        names={names}
        aid={{ usa: 50 }}
        onChange={onChange}
        budgetLeft={30}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Добавить помощь США' }))
    // 50 + 50 would overshoot the 30 $ left, so the click lands exactly on 80.
    expect(onChange).toHaveBeenLastCalledWith({ usa: 80 })

    rerender(
      <AidFields option={aid} names={names} aid={{ usa: 80 }} onChange={onChange} budgetLeft={0} />,
    )
    expect(screen.getByRole('button', { name: 'Добавить помощь США' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('steps by the minimum the rules require', async () => {
    const onChange = vi.fn()
    render(
      <AidFields
        option={option({ id: 'aid', targets: ['usa'], min_amount: 100 })}
        names={names}
        aid={{}}
        onChange={onChange}
        budgetLeft={1000}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Добавить помощь США' }))
    expect(onChange).toHaveBeenCalledWith({ usa: 100 })
  })

  it('cannot send a cent once the budget is gone', () => {
    render(<AidFields option={aid} names={names} aid={{}} onChange={vi.fn()} budgetLeft={0} />)
    expect(screen.getByRole('button', { name: 'Добавить помощь США' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Убрать помощь США' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('locks both buttons while the form is busy', () => {
    render(
      <AidFields
        option={aid}
        names={names}
        aid={{}}
        onChange={vi.fn()}
        budgetLeft={100}
        disabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Добавить помощь США' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Убрать помощь США' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('renders nothing when the engine offers no targets', () => {
    const { container } = render(
      <AidFields
        option={option({ id: 'aid', targets: null })}
        names={names}
        aid={{}}
        onChange={vi.fn()}
        budgetLeft={100}
      />,
    )
    expect(container.querySelectorAll('button')).toHaveLength(0)
  })
})
