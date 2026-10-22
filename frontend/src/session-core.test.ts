import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { homeOf, JoinError, useSession } from './session-core'
import { HOST, PLAYER } from './test/session'

describe('homeOf', () => {
  it('sends the host to the panel', () => {
    expect(homeOf(HOST)).toBe('/host/g1')
  })

  it('sends a player to their screen', () => {
    expect(homeOf(PLAYER)).toBe('/play/g1')
  })
})

describe('JoinError', () => {
  it('keeps the HTTP status and the message', () => {
    const err = new JoinError(409, 'bot')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(409)
    expect(err.message).toBe('bot')
  })
})

describe('useSession', () => {
  it('throws outside SessionProvider', () => {
    expect(() => renderHook(() => useSession())).toThrow('useSession outside SessionProvider')
  })
})
