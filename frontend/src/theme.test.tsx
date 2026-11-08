import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ThemeToggle } from './ThemeToggle'

const KEY = 'arena-theme'
const META = 'meta[name="theme-color"]'

function ensureMeta(): Element {
  let meta = document.querySelector(META)
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  return meta
}

beforeEach(() => {
  localStorage.removeItem(KEY)
  document.documentElement.removeAttribute('data-theme')
  ensureMeta().setAttribute('content', '#f6f7f9')
})

afterEach(() => {
  localStorage.removeItem(KEY)
  document.documentElement.removeAttribute('data-theme')
})

describe('ThemeToggle', () => {
  it('starts light and switches to dark on click', async () => {
    render(<ThemeToggle />)
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Включить тёмную тему' }))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(localStorage.getItem(KEY)).toBe('dark')
  })

  it('starts dark when the stored choice says so and switches back', async () => {
    localStorage.setItem(KEY, 'dark')
    render(<ThemeToggle />)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    await userEvent.click(screen.getByRole('button', { name: 'Включить светлую тему' }))
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
    expect(localStorage.getItem(KEY)).toBe('light')
  })

  it('repaints the mobile browser chrome via the theme-color meta', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByRole('button', { name: 'Включить тёмную тему' }))
    expect(document.querySelector(META)?.getAttribute('content')).toBe('#0f172a')
    await userEvent.click(screen.getByRole('button', { name: 'Включить светлую тему' }))
    expect(document.querySelector(META)?.getAttribute('content')).toBe('#f6f7f9')
  })
})
