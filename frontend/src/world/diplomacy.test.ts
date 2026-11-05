import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { readDiplomacy, relationOf, useDiplomacy } from './diplomacy'

beforeEach(() => window.localStorage.clear())

describe('readDiplomacy', () => {
  it('reads what was written for that game only', () => {
    window.localStorage.setItem(
      'arena-diplo:g1',
      JSON.stringify({ usa: 'enemy', france: 'friend' }),
    )
    expect(readDiplomacy('g1')).toEqual({ usa: 'enemy', france: 'friend' })
    expect(readDiplomacy('g2')).toEqual({})
  })

  it('survives broken and foreign data', () => {
    window.localStorage.setItem('arena-diplo:g1', '{not json')
    expect(readDiplomacy('g1')).toEqual({})
    window.localStorage.setItem('arena-diplo:g1', JSON.stringify({ usa: 'hate', x: 42 }))
    expect(readDiplomacy('g1')).toEqual({})
  })

  it('reads an empty store as neutral everywhere', () => {
    expect(readDiplomacy('g1')).toEqual({})
    expect(relationOf({}, 'usa')).toBe('neutral')
  })
})

describe('useDiplomacy', () => {
  it('sets and clears marks, writing through to storage', () => {
    const { result } = renderHook(() => useDiplomacy('g1'))

    act(() => result.current.setRelation('usa', 'enemy'))
    expect(result.current.relations).toEqual({ usa: 'enemy' })
    expect(readDiplomacy('g1')).toEqual({ usa: 'enemy' })

    act(() => result.current.setRelation('usa', 'friend'))
    expect(readDiplomacy('g1')).toEqual({ usa: 'friend' })

    // Neutral is the absence of a mark.
    act(() => result.current.setRelation('usa', 'neutral'))
    expect(result.current.relations).toEqual({})
    expect(readDiplomacy('g1')).toEqual({})
  })

  it('reloads marks when the game id changes', () => {
    window.localStorage.setItem('arena-diplo:g1', JSON.stringify({ usa: 'enemy' }))
    const { result, rerender } = renderHook(({ gameId }) => useDiplomacy(gameId), {
      initialProps: { gameId: 'g1' },
    })
    expect(result.current.relations).toEqual({ usa: 'enemy' })

    rerender({ gameId: 'g2' })
    expect(result.current.relations).toEqual({})
  })

  it('works without a game id (no storage touch)', () => {
    const { result } = renderHook(() => useDiplomacy(undefined))
    act(() => result.current.setRelation('usa', 'enemy'))
    expect(result.current.relations).toEqual({ usa: 'enemy' })
  })
})
