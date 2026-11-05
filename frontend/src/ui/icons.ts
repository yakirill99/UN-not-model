/**
 * Address of an icon file. The set lives in `frontend/public/icons/` as flat
 * SVGs with fixed names; the name of a file is the whole configuration — swap
 * the file with your own artwork (keep the name) and the game restyles itself
 * after the next web rebuild. No yaml, no imports.
 */
export function iconUrl(name: string): string {
  return `${import.meta.env.BASE_URL}icons/${name}.svg`
}
