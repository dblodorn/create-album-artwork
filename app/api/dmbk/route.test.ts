import { beforeEach, describe, expect, it, vi } from 'vitest'

const viewerFromRequest = vi.fn()
const callDmbkApi = vi.fn()

vi.mock('@/lib/auth/viewer', () => ({
  readSessionToken: vi.fn(async () => 'session-token'),
  viewerFromRequest: () => viewerFromRequest(),
}))
vi.mock('@/lib/dmbk/api', () => ({
  DmbkNotConfiguredError: class extends Error {},
  callDmbkApi: (...args: unknown[]) => callDmbkApi(...args),
}))

const { POST } = await import('./route')

const request = (operation: string, variables: object) =>
  new Request('http://localhost:3000/api/dmbk', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' },
    body: JSON.stringify({ operation, variables }),
  })

const admin = { id: '1', email: 'a@example.com', name: null, image: null, isAdmin: true }

beforeEach(() => {
  viewerFromRequest.mockReset()
  callDmbkApi.mockReset()
  callDmbkApi.mockResolvedValue({ status: 200, data: { ok: true } })
})

describe('/api/dmbk admin-only operations', () => {
  it('refuses signed-out requests without calling the API', async () => {
    viewerFromRequest.mockResolvedValue(null)
    const res = await POST(request('DmbkPhotos', { first: 10 }))
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthenticated' })
    expect(callDmbkApi).not.toHaveBeenCalled()
  })

  it('refuses non-admins without calling the API', async () => {
    viewerFromRequest.mockResolvedValue({ ...admin, isAdmin: false })
    const res = await POST(request('DmbkPhotos', { first: 10 }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'forbidden' })
    expect(callDmbkApi).not.toHaveBeenCalled()
  })

  it('forwards for admins, with the session', async () => {
    viewerFromRequest.mockResolvedValue(admin)
    const res = await POST(request('DmbkPhotos', { first: 10, keywords: ['beach'] }))
    expect(res.status).toBe(200)
    expect(callDmbkApi).toHaveBeenCalledWith(
      expect.stringContaining('dmbkPhotos('),
      { first: 10, after: null, keywords: ['beach'] },
      'session-token'
    )
  })

  it('leaves public operations alone when signed out', async () => {
    viewerFromRequest.mockResolvedValue(null)
    const res = await POST(request('LoraTrainings', { first: 10 }))
    expect(res.status).toBe(200)
    expect(viewerFromRequest).not.toHaveBeenCalled()
    expect(callDmbkApi).toHaveBeenCalled()
  })
})
