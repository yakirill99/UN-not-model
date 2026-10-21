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
    render(<ActionHeader option={option({ id: 'invest', cost: 150 })} />)
    expect(screen.getByText('150 $')).toBeTruthy()
  })

  it('calls a free action free', () => {
    render(<ActionHeader option={option({ id: 'strike', cost: 0 })} />)
    expect(screen.getByText('бесплатно')).toBeTruthy()
  })

  it('explains why a blocked action is blocked', () => {
    render(<ActionHeader option={option({ id: 'bomb', available: false, reason: 'no_bombs' })} />)
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

  it('records an amount per recipient', async () => {
    const onChange = vi.fn()
    render(<AidFields option={aid} names={names} aid={{}} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('США'), '5')
    expect(onChange).toHaveBeenCalledWith({ usa: 5 })
  })

  it('drops the recipient when the field is cleared', async () => {
    const onChange = vi.fn()
    render(<AidFields option={aid} names={names} aid={{ usa: 5 }} onChange={onChange} />)
    await userEvent.clear(screen.getByLabelText('США'))
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('treats zero as no aid rather than a zero transfer', async () => {
    const onChange = vi.fn()
    render(<AidFields option={aid} names={names} aid={{}} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('США'), '0')
    expect(onChange).toHaveBeenLastCalledWith({})
  })

  it('offers the minimum the rules require', () => {
    render(
      <AidFields
        option={option({ id: 'aid', targets: ['usa'], min_amount: 10 })}
        names={names}
        aid={{}}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('США').getAttribute('min')).toBe('10')
  })

  it('falls back to a minimum of 1 when the rules omit it', () => {
    render(
      <AidFields
        option={option({ id: 'aid', targets: ['usa'] })}
        names={names}
        aid={{}}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByLabelText('США').getAttribute('min')).toBe('1')
  })

  it('locks while busy', () => {
    render(<AidFields option={aid} names={names} aid={{}} onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('США')).toHaveProperty('disabled', true)
  })
})
