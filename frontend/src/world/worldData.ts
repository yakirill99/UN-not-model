/**
 * The real-world borders behind the «Мир» map: world-atlas 1:50m TopoJSON,
 * served from /public/geo so the browser caches it between rounds. We keep
 * d3-geo (the projection + path engine react-simple-maps itself is built on)
 * without the wrapper — React 19 is not on its support list.
 */
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'

/** One country shape of the world file; `id` is the ISO-3166-1 numeric code. */
export type CountryFeature = Feature<Geometry, { name?: string }> & { id?: string | number }

/** Antarctica carries no delegation and eats a third of the projection — out. */
const SKIP = new Set(['010'])

let cache: CountryFeature[] | null = null

export async function loadWorld(): Promise<CountryFeature[]> {
  if (cache) return cache
  const res = await fetch(`${import.meta.env.BASE_URL}geo/countries-50m.json`)
  if (!res.ok) throw new Error(`world atlas: HTTP ${res.status}`)
  const topo = (await res.json()) as Parameters<typeof feature>[0]
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name?: string }>
  cache = fc.features.filter((f) => !SKIP.has(String(f.id))) as CountryFeature[]
  return cache
}
