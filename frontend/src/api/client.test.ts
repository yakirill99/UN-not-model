import { describe, expect, it } from 'vitest'
import { errorMessage, orderErrors } from './client'

describe('errorMessage', () => {
  it('returns a string detail as is', () => {
    expect(errorMessage({ detail: 'not found' })).toBe('not found')
  })

  it('ignores a non-string detail (FastAPI validation list, numbers)', () => {
    expect(errorMessage({ detail: [{ msg: 'bad' }] })).toBe('Ошибка запроса')
    expect(errorMessage({ detail: 42 })).toBe('Ошибка запроса')
  })

  it('falls back when there is no detail at all', () => {
    expect(errorMessage({})).toBe('Ошибка запроса')
    expect(errorMessage(null)).toBe('Ошибка запроса')
    expect(errorMessage(undefined)).toBe('Ошибка запроса')
    expect(errorMessage('plain')).toBe('Ошибка запроса')
  })
})

describe('orderErrors', () => {
  it('recovers the array the API adds next to detail', () => {
    const errors = [
      { action: 'strike', target: 'nyc', reason: 'invalid_target' },
      { action: '*', reason: 'over_budget' },
    ]
    expect(orderErrors({ detail: 'orders rejected', errors })).toEqual(errors)
  })

  it('is empty for an error without the array', () => {
    expect(orderErrors({ detail: 'orders are closed' })).toEqual([])
    expect(orderErrors(null)).toEqual([])
    expect(orderErrors(undefined)).toEqual([])
    expect(orderErrors('boom')).toEqual([])
  })

  it('is empty when errors is not an array', () => {
    expect(orderErrors({ errors: 'nope' })).toEqual([])
  })

  it('drops malformed items instead of trusting the shape', () => {
    const good = { action: 'aid', reason: 'below_minimum' }
    expect(orderErrors({ errors: [good, { action: 'aid' }, null, 42] })).toEqual([good])
  })
})
