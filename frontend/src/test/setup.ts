import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// globals: false, so RTL does not auto-cleanup between tests — do it here.
afterEach(cleanup)

// jsdom has no ResizeObserver; recharts sizes its plot through one, and
// without the stub the chart body never renders in tests (legend only).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  ;(window as unknown as { ResizeObserver: typeof ResizeObserverStub }).ResizeObserver =
    ResizeObserverStub
}
