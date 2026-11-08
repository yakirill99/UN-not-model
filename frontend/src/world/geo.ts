/**
 * Where the countries of the world sit on the map, and which flag
 * file belongs to them. Names are the ones the scenarios speak (Russian).
 *
 * The table is a plain data file: add a line for a new country and both the
 * map and the flags pick it up. Countries missing from the table are not
 * lost — the map places them into an index strip under the map.
 */
import table from './countries.json'

export type CountryGeo = { iso: string; lat: number; lon: number; num?: string }

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

/**
 * The ISO-3166-1 numeric code the world TopoJSON (public/geo/countries-50m.json)
 * keys its features by. A country without a code has no borders on the map and
 * falls into the index strip instead.
 */
export function numOf(name: string): string | undefined {
  return geoOf(name)?.num
}
