import { useEffect, useRef } from 'react'

/**
 * The page refreshes itself: the players should not F5 to see the round's
 * results — «чтобы web автоматически обновлялся у участников».
 *
 * A quiet interval re-runs `load` while the tab is visible; returning to the
 * tab refreshes immediately, so a phone that slept through the round's end
 * catches up on focus. One request at a time: a slow response never stacks
 * up a queue of fetches. Errors are left to `load` to render — a network
 * blip just waits for the next tick.
 */
export function useAutoRefresh(load: () => Promise<unknown> | void, ms = 7000): void {
  const running = useRef(false)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    const tick = () => {
      if (running.current || document.visibilityState !== 'visible') return
      running.current = true
      Promise.resolve(loadRef.current()).then(
        () => {
          running.current = false
        },
        () => {
          // A failed refresh is not fatal: `load` renders the error, the next
          // tick tries again. Swallow the rejection so the console stays calm.
          running.current = false
        },
      )
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const id = window.setInterval(tick, ms)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ms])
}
