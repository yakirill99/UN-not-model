import { useTheme } from './theme'

/** The theme switch pinned to the top-right corner of every page. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button
      type="button"
      className="ghost theme-toggle"
      aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      onClick={toggle}
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
