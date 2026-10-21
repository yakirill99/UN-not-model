import { describe, expect, it } from 'vitest'
import { errorMessage } from './client'

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
