/**
 * Typed HTTP client for the World Arena API.
 *
 * Types come from `schema.d.ts`, generated from the backend's OpenAPI document
 * (`just openapi`). Paths and bodies are checked at compile time, so an API change
 * that breaks the client is a type error, not a runtime surprise.
 *
 * The session lives in the httpOnly cookie set by POST /api/auth/join; in dev the
 * Vite proxy keeps everything same-origin, so no token handling is needed here.
 */
import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export const api = createClient<paths>({ baseUrl: '/', credentials: 'include' })

export type Schemas = components['schemas']
export type Principal = Schemas['Principal']
export type GameInfo = Schemas['GameInfo']
export type Observation = Schemas['Observation']
export type ActionSpace = Schemas['ActionSpace']
export type CountryOrders = Schemas['CountryOrders']
export type RoundStatus = Schemas['RoundStatus']
export type RoundResult = Schemas['RoundResult']

/** One item of `errors[]` in a 422 from PUT /orders (raised by the error handler, not in the schema). */
export type OrderError = { action: string; target?: string | null; reason: string }

/** `detail` of an error response, or a generic message. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  return 'Ошибка запроса'
}
