import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoRefresh } from './useAutoRefresh'

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('reloads on the interval while the tab is visible', async () => {
    const load = vi.fn()
    renderHook(() => useAutoRefresh(load, 7000))
    expect(load).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('does not reload while the tab is hidden, catches up on return', async () => {
    const load = vi.fn()
    renderHook(() => useAutoRefresh(load, 7000))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await vi.advanceTimersByTimeAsync(21000)
    expect(load).not.toHaveBeenCalled()

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('never stacks a second load while one is in flight', async () => {
    let release: () => void = () => {}
    const load = vi.fn(() => new Promise<void>((resolve) => (release = resolve)))
    renderHook(() => useAutoRefresh(load, 7000))
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(21000)
    expect(load).toHaveBeenCalledTimes(1) // still pending — no queue of fetches
    release()
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('survives a rejecting load and keeps ticking', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('network blip'))
    renderHook(() => useAutoRefresh(load, 7000))
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(7000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('stops on unmount', async () => {
    const load = vi.fn()
    const { unmount } = renderHook(() => useAutoRefresh(load, 7000))
    unmount()
    await vi.advanceTimersByTimeAsync(21000)
    expect(load).not.toHaveBeenCalled()
  })
})
