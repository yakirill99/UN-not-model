import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const KEY = 'arena-theme'

/** Light is the default (the playtest called auto-dark «мрачно»); dark is opt-in and remembered. */
function initialTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light' // private mode etc.
  }
}

/**
 * Owns `<html data-theme>` (see index.css), the stored preference and the
 * `theme-color` meta tag mobile browsers paint their chrome from.
 * The toggle is the only consumer today; if a second one appears, lift this
 * state into a context instead of instantiating the hook twice.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* storage unavailable — the choice just won't survive a reload */
    }
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0f172a' : '#f6f7f9')
  }, [theme])

  return { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }
}
