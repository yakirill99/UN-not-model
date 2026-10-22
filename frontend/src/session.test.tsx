import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api/client'
import { SessionProvider } from './session'
import { JoinError, useSession } from './session-core'
import { HOST, PLAYER } from './test/session'

vi.mock('./api/client', () => ({
  api: { GET: vi.fn(), POST: vi.fn() },
  errorMessage: (e: { detail?: string } | undefined) => e?.detail ?? 'Ошибка запроса',
}))

const GET = vi.mocked(api.GET)
const POST = vi.mocked(api.POST)

const wrapper = ({ children }: { children: ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
)

async function mounted() {
  const hook = renderHook(() => useSession(), { wrapper })
  await waitFor(() => expect(hook.result.current.principal).not.toBeUndefined())
  return hook
}

describe('SessionProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('is undefined while /me is in flight', () => {
    GET.mockReturnValue(new Promise(() => {}) as never)
    const { result } = renderHook(() => useSession(), { wrapper })
    expect(result.current.principal).toBeUndefined()
  })

  it('restores the session from /me (plain Principal, no wrapper)', async () => {
    GET.mockResolvedValue({ data: PLAYER } as never)
    const { result } = await mounted()
    expect(GET).toHaveBeenCalledWith('/api/auth/me')
    expect(result.current.principal).toEqual(PLAYER)
  })

  it('no cookie: /me fails -> null, not an error', async () => {
    GET.mockResolvedValue({ data: undefined, error: { detail: 'no session' } } as never)
    const { result } = await mounted()
    expect(result.current.principal).toBeNull()
  })

  it('network failure on /me -> null', async () => {
    GET.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = await mounted()
    expect(result.current.principal).toBeNull()
  })

  it('join normalises the code and stores the principal', async () => {
    GET.mockResolvedValue({ data: undefined } as never)
    POST.mockResolvedValue({
      data: { principal: HOST, token: 'jwt' },
      response: new Response(null, { status: 200 }),
    } as never)
    const { result } = await mounted()

    let returned
    await act(async () => {
      returned = await result.current.join('  host-dzrs3a ')
    })

    expect(POST).toHaveBeenCalledWith('/api/auth/join', { body: { code: 'HOST-DZRS3A' } })
    expect(returned).toEqual(HOST)
    expect(result.current.principal).toEqual(HOST)
  })

  it('join failure throws JoinError with status and detail, session untouched', async () => {
    GET.mockResolvedValue({ data: undefined } as never)
    POST.mockResolvedValue({
      data: undefined,
      error: { detail: 'unknown code' },
      response: new Response(null, { status: 404 }),
    } as never)
    const { result } = await mounted()

    const err = await result.current.join('BAD1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(JoinError)
    expect(err).toMatchObject({ status: 404, message: 'unknown code' })
    expect(result.current.principal).toBeNull()
  })

  it('logout calls the API and clears the principal', async () => {
    GET.mockResolvedValue({ data: HOST } as never)
    POST.mockResolvedValue({ data: undefined } as never)
    const { result } = await mounted()

    await act(() => result.current.logout())

    expect(POST).toHaveBeenCalledWith('/api/auth/logout')
    expect(result.current.principal).toBeNull()
  })
})
