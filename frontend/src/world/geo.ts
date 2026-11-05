/**
 * Where the countries of the world sit on the stylized map, and which flag
 * file belongs to them. Names are the ones the scenarios speak (Russian).
 *
 * The table is a plain data file: add a line for a new country and both the
 * map and the flags pick it up. Countries missing from the table are not
 * lost — the map places them into an index strip at the bottom.
 */
import table from './countries.json'

export type CountryGeo = { iso: string; lat: number; lon: number }

/** Spelled-differently names that mean the same country. */
const ALIASES: Record<string, string> = {
  'Российская Федерация': 'Россия',
  'Соединённые Штаты': 'США',
  'Соединённые Штаты Америки': 'США',
  'Северная Корея': 'КНДР',
  'Республика Корея': 'Южная Корея',
  'Объединённые Арабские Эмираты': 'ОАЭ',
  'Южно-Африканская Республика': 'ЮАР',
}

export function geoOf(name: string): CountryGeo | undefined {
  const key = ALIASES[name] ?? name
  return (table as Record<string, CountryGeo>)[key]
}

/** The stylized map canvas: 720×360, equirectangular. */
export const MAP_W = 720
export const MAP_H = 360

/** Equirectangular projection of a geo point into the map viewBox. */
export function project(lon: number, lat: number): { x: number; y: number } {
  return { x: (lon + 180) * (MAP_W / 360), y: (90 - lat) * (MAP_H / 360) }
}
